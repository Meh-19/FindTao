export type Marketplace = "taobao" | "weidian" | "1688" | "xianyu";

export interface ParsedLink {
  marketplace: Marketplace;
  itemId: string;
  /** Canonical marketplace URL rebuilt from marketplace + itemId. */
  rawUrl: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  /**
   * URL templates. Variables: {itemId}, {encodedRawUrl}, {marketplace}.
   * "all" applies to any marketplace unless a specific key overrides it.
   */
  templates: Partial<Record<Marketplace | "all", string>>;
  /** Affiliate/referral query fragment appended to every link, e.g. "ref=findtao". */
  ref?: string;
  active: boolean;
  homepage: string;
  note?: string;
}

export function canonicalUrl(marketplace: Marketplace, itemId: string): string {
  switch (marketplace) {
    case "taobao":
      return `https://item.taobao.com/item.htm?id=${itemId}`;
    case "weidian":
      return `https://weidian.com/item.html?itemID=${itemId}`;
    case "1688":
      return `https://detail.1688.com/offer/${itemId}.html`;
    case "xianyu":
      return `https://www.goofish.com/item?id=${itemId}`;
  }
}

function makeParsed(marketplace: Marketplace, itemId: string): ParsedLink {
  return { marketplace, itemId, rawUrl: canonicalUrl(marketplace, itemId) };
}

function getParam(params: URLSearchParams, ...names: string[]): string | null {
  for (const name of names) {
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase() === name.toLowerCase() && value) return value;
    }
  }
  return null;
}

const SHORT_LINK_HOSTS = ["tb.cn", "m.tb.cn", "e.tb.cn", "qr.1688.com", "k.youshop10.com"];

/** Short links need a network redirect to resolve; the UI tells users to open them first. */
export function isShortLink(input: string): boolean {
  const url = safeUrl(input);
  if (!url) return false;
  return SHORT_LINK_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

function safeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function tryDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseWrapped(wrapped: string, depth: number): ParsedLink | null {
  // URLSearchParams already decoded once; try as-is, then one more decode
  // for double-encoded links copied out of other converters.
  const decoded = tryDecode(wrapped);
  return parseLink(wrapped, depth + 1) ?? (decoded !== wrapped ? parseLink(decoded, depth + 1) : null);
}

const AGENT_SHOP_TYPE_MAP: Record<string, Marketplace> = {
  taobao: "taobao",
  tmall: "taobao",
  weidian: "weidian",
  micro: "weidian",
  ali_1688: "1688",
  "1688": "1688",
  alibaba: "1688",
  xianyu: "xianyu",
  goofish: "xianyu",
  idlefish: "xianyu",
};

/**
 * Parse any Taobao/Tmall/Weidian/1688/Xianyu link — or a known agent link wrapping one —
 * down to { marketplace, itemId }. Returns null for unrecognized or short links.
 */
export function parseLink(input: string, depth = 0): ParsedLink | null {
  if (depth > 3) return null;
  const url = safeUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const params = url.searchParams;

  // Xianyu first — 2.taobao.com would otherwise match the taobao branch.
  if (host.endsWith("goofish.com") || host === "2.taobao.com" || host.endsWith(".2.taobao.com")) {
    const id = getParam(params, "id", "itemId");
    if (id && /^\d+$/.test(id)) return makeParsed("xianyu", id);
    return null;
  }

  if (host.endsWith("taobao.com") || host.endsWith("tmall.com")) {
    const id = getParam(params, "id");
    if (id && /^\d+$/.test(id)) return makeParsed("taobao", id);
    const pathMatch = url.pathname.match(/\/item\/(\d+)/);
    if (pathMatch) return makeParsed("taobao", pathMatch[1]);
    return null;
  }

  if (host.endsWith("weidian.com")) {
    const id = getParam(params, "itemID", "itemId", "item_id", "id");
    if (id && /^\d+$/.test(id)) return makeParsed("weidian", id);
    return null;
  }

  if (host.endsWith("1688.com")) {
    const offerMatch = url.pathname.match(/\/offer\/(\d+)\.html/);
    if (offerMatch) return makeParsed("1688", offerMatch[1]);
    return null;
  }

  // CSSBuy encodes marketplace + id in the path: item-{id}, item-micro-{id}, item-1688-{id}.
  if (host.endsWith("cssbuy.com")) {
    const m = url.pathname.match(/\/item(?:-(micro|1688))?-(\d+)(?:\.html)?/);
    if (m) return makeParsed(m[1] === "micro" ? "weidian" : m[1] === "1688" ? "1688" : "taobao", m[2]);
    return null;
  }

  // Basetao paths look like .../products/agent/{platform}/{id}.html
  if (host.endsWith("basetao.com")) {
    const m = url.pathname.match(/\/agent\/(taobao|tmall|weidian|1688)\/(\d+)/);
    if (m) return makeParsed(m[1] === "tmall" ? "taobao" : (m[1] as Marketplace), m[2]);
    return null;
  }

  // Agent links, family 1: whole marketplace URL in a query param.
  const wrapped = getParam(params, "url", "productLink", "goodsUrl", "link");
  if (wrapped) {
    const inner = parseWrapped(wrapped, depth);
    if (inner) return inner;
  }

  // Sugargoo-style: the query lives inside the hash fragment.
  if (url.hash.includes("?")) {
    const hashParams = new URLSearchParams(url.hash.slice(url.hash.indexOf("?") + 1));
    const hashWrapped = getParam(hashParams, "url", "productLink", "goodsUrl", "link");
    if (hashWrapped) {
      const inner = parseWrapped(hashWrapped, depth);
      if (inner) return inner;
    }
    const shopType = getParam(hashParams, "shop_type", "shoptype", "platform");
    const hashId = getParam(hashParams, "id", "itemId", "num_iid");
    if (shopType && hashId && AGENT_SHOP_TYPE_MAP[shopType.toLowerCase()]) {
      return makeParsed(AGENT_SHOP_TYPE_MAP[shopType.toLowerCase()], hashId);
    }
  }

  // Agent links, family 2: shop_type + id query params (CNFans/Mulebuy style).
  const shopType = getParam(params, "shop_type", "shoptype", "platform");
  const id = getParam(params, "id", "itemId", "num_iid");
  if (shopType && id && AGENT_SHOP_TYPE_MAP[shopType.toLowerCase()]) {
    return makeParsed(AGENT_SHOP_TYPE_MAP[shopType.toLowerCase()], id);
  }

  return null;
}

/**
 * Order to default to when a seller lists the same piece on several platforms.
 * Taobao leads on breadth of agent support; the album viewer lets the shopper
 * switch, so this only decides what's pre-selected.
 */
const MARKETPLACE_PREFERENCE: Marketplace[] = ["taobao", "weidian", "1688", "xianyu"];

export interface MarketplaceLinks {
  /** At most one link per marketplace, in preference order. */
  all: ParsedLink[];
  /** What to use unless the shopper picks otherwise. */
  best: ParsedLink | null;
}

/**
 * Resolve the raw links scraped from a Yupoo album description into one
 * canonical item link per marketplace.
 *
 * Sellers paste the same item several times (a bare link, then pre-built agent
 * links), list Weidian and Taobao side by side, and — seen in the wild — get
 * their own copy-paste wrong, pointing an agent link at a *different* album's
 * item. So this only trusts direct marketplace links and rebuilds everything
 * from the parsed id, rather than reusing a seller's prebuilt agent URL (which
 * would also hand them the affiliate commission).
 */
export function pickMarketplaceLinks(raw: string[]): MarketplaceLinks {
  const byMarketplace = new Map<Marketplace, ParsedLink>();
  for (const input of raw) {
    const parsed = parseLink(input);
    // First win per marketplace — the seller's own listing order.
    if (parsed && !byMarketplace.has(parsed.marketplace)) byMarketplace.set(parsed.marketplace, parsed);
  }
  const all = MARKETPLACE_PREFERENCE.filter((m) => byMarketplace.has(m)).map((m) => byMarketplace.get(m)!);
  return { all, best: all[0] ?? null };
}

/** Append a referral query fragment (e.g. "partnercode=ABC") to a built URL. */
export function withRef(url: string | null, code: string | null | undefined): string | null {
  if (!url) return url;
  const trimmed = code?.trim();
  if (!trimmed) return url;
  return url + (url.includes("?") ? "&" : "?") + trimmed.replace(/^[?&]+/, "");
}

/** Build the agent's product URL for a parsed link. Null if the agent has no template for that marketplace. */
export function toAgentUrl(link: ParsedLink, agent: AgentConfig): string | null {
  const template = agent.templates[link.marketplace] ?? agent.templates.all;
  if (!template) return null;
  let out = template
    .replaceAll("{itemId}", link.itemId)
    .replaceAll("{encodedRawUrl}", encodeURIComponent(link.rawUrl))
    .replaceAll("{marketplace}", link.marketplace);
  if (agent.ref) out += (out.includes("?") ? "&" : "?") + agent.ref;
  return out;
}

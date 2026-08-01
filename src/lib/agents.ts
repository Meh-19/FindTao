import type { AgentConfig } from "./links";

/**
 * Agent registry. Data, not code: adding/retiring an agent or fixing a URL
 * format is an edit here (or in a DB row later), never a logic change.
 *
 * ⚠ Template shapes are best-effort and drift over time — verify each one
 * against the live agent site before launch. See README "Verifying agents".
 */
export const AGENTS: AgentConfig[] = [
  {
    id: "kakobuy",
    name: "Kakobuy",
    homepage: "https://www.kakobuy.com",
    templates: { all: "https://www.kakobuy.com/item/details?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "superbuy",
    name: "Superbuy",
    homepage: "https://www.superbuy.com",
    templates: { all: "https://www.superbuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "wegobuy",
    name: "Wegobuy",
    homepage: "https://www.wegobuy.com",
    templates: { all: "https://www.wegobuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: false,
    note: "Domain no longer resolves (no DNS A/AAAA records as of 2026-07) — superseded by AllChinaBuy, its live international rebrand with the same link format. Flip active only if wegobuy.com returns.",
  },
  {
    id: "sugargoo",
    name: "Sugargoo",
    homepage: "https://www.sugargoo.com",
    templates: { all: "https://www.sugargoo.com/#/home/productDetail?productLink={encodedRawUrl}" },
    active: true,
  },
  {
    id: "cnfans",
    name: "CNFans",
    homepage: "https://cnfans.com",
    templates: {
      taobao: "https://cnfans.com/product/?shop_type=taobao&id={itemId}",
      weidian: "https://cnfans.com/product/?shop_type=weidian&id={itemId}",
      "1688": "https://cnfans.com/product/?shop_type=ali_1688&id={itemId}",
    },
    active: true,
  },
  {
    id: "mulebuy",
    name: "Mulebuy",
    homepage: "https://mulebuy.com",
    templates: {
      taobao: "https://mulebuy.com/product/?shop_type=taobao&id={itemId}",
      weidian: "https://mulebuy.com/product/?shop_type=weidian&id={itemId}",
      "1688": "https://mulebuy.com/product/?shop_type=ali_1688&id={itemId}",
    },
    active: true,
  },
  {
    id: "cssbuy",
    name: "CSSBuy",
    homepage: "https://www.cssbuy.com",
    templates: {
      taobao: "https://www.cssbuy.com/item-{itemId}.html",
      weidian: "https://www.cssbuy.com/item-micro-{itemId}.html",
      "1688": "https://www.cssbuy.com/item-1688-{itemId}.html",
    },
    active: true,
  },
  {
    id: "basetao",
    name: "Basetao",
    homepage: "https://www.basetao.com",
    templates: {
      taobao: "https://www.basetao.com/best-taobao-agent-service/products/agent/taobao/{itemId}.html",
      weidian: "https://www.basetao.com/best-taobao-agent-service/products/agent/weidian/{itemId}.html",
      "1688": "https://www.basetao.com/best-taobao-agent-service/products/agent/1688/{itemId}.html",
    },
    active: true,
    note: "Unverified — this product path 301-redirects to basetao.com/ for test item IDs. Confirm against a real Basetao product URL before trusting; the path may be stale.",
  },
  {
    id: "allchinabuy",
    name: "AllChinaBuy",
    homepage: "https://www.allchinabuy.com",
    templates: { all: "https://www.allchinabuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "loongbuy",
    name: "Loongbuy",
    homepage: "https://www.loongbuy.com",
    templates: { all: "https://www.loongbuy.com/product-details?url={encodedRawUrl}" },
    active: true,
    note: "Format unverified — confirm against a real Loongbuy product page.",
  },
  {
    id: "gtbuy",
    name: "GTBuy",
    homepage: "https://www.gtbuy.com",
    templates: { all: "https://www.gtbuy.com/goods/detail?url={encodedRawUrl}" },
    active: true,
    note: "Format unverified — confirm against a real GTBuy product page.",
  },
  {
    id: "pandabuy",
    name: "Pandabuy",
    homepage: "https://www.pandabuy.com",
    templates: { all: "https://www.pandabuy.com/product?url={encodedRawUrl}" },
    active: false,
    note: "Largely defunct since 2024 — flip active if it returns.",
  },

  // ── Newer agents. The `?url=`/`productUrl=` ones pass the full canonical URL
  //    (the agent resolves it), so they're robust across marketplaces; the
  //    shop_type ones share the CNFans/Mulebuy platform format. Formats captured
  //    from rep.tools' live converter — confirm against a real product page. ──
  {
    id: "joyagoo",
    name: "Joyagoo",
    homepage: "https://joyagoo.com",
    templates: {
      taobao: "https://joyagoo.com/product/?shop_type=taobao&id={itemId}",
      weidian: "https://joyagoo.com/product/?shop_type=weidian&id={itemId}",
      "1688": "https://joyagoo.com/product/?shop_type=ali_1688&id={itemId}",
    },
    active: true,
    note: "Shares the CNFans/Mulebuy shop_type format; verified live on rep.tools.",
  },
  {
    id: "itaobuy",
    name: "ItaoBuy",
    homepage: "https://www.itaobuy.com",
    templates: { all: "https://www.itaobuy.com/product-detail?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "bbdbuy",
    name: "BBDBuy",
    homepage: "https://bbdbuy.com",
    templates: { all: "https://bbdbuy.com/index/item/index.html?tp=taobao&tid=&searchlang=en&url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "pikobuy",
    name: "PikoBuy",
    homepage: "https://www.pikobuy.com",
    templates: { all: "https://www.pikobuy.com/product/detail?productUrl={encodedRawUrl}" },
    active: true,
  },
  // Other live agents seen on rep.tools (acbuy, hoobuy, oopbuy, ootdbuy,
  // lovegobuy, hipobuy, cnshopper, …) use id-only paths whose per-marketplace
  // shape couldn't be confirmed. They're intentionally omitted rather than
  // shipped as guesses — every registered agent must round-trip (see
  // links.test.ts), which an unconfirmed id-only template can't. Add them here
  // once verified against a live product page.
];

export const ACTIVE_AGENTS = AGENTS.filter((a) => a.active);

export const DEFAULT_AGENT_ID = ACTIVE_AGENTS[0].id;

export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id);
}

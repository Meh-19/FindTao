import type { Marketplace } from "./links";
import { parsePriceCnyDetailed } from "./price";

/** Best-effort product snapshot scraped from a marketplace item page's HTML. */
export interface MarketplacePreview {
  title: string | null;
  image: string | null;
  priceCny: number | null;
  /** True when the price came from the loose number fallback, not an explicit field. */
  priceEstimate: boolean;
  /** Weidian seller id, when found — powers the in-app "View store" hand-off. */
  sellerUserId: string | null;
  /** A resolvable seller shop URL, when found. */
  sellerShopUrl: string | null;
}

const NUMERIC_ENTITY = /&#(\d+);/g;
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
};

/** Decode the handful of HTML entities that show up in og: meta content. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;|&quot;|&#39;|&apos;|&lt;|&gt;|&nbsp;/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(NUMERIC_ENTITY, (_, code) => String.fromCodePoint(Number(code)));
}

/**
 * Read a `<meta>` content value by property/name, tolerant of attribute order
 * (`property` before or after `content`) and single/double quotes.
 */
function metaContent(html: string, key: string): string | null {
  const attr = `(?:property|name|itemprop)=["']${key}["']`;
  const content = `content=["']([^"']*)["']`;
  const m =
    html.match(new RegExp(`<meta[^>]+${attr}[^>]+${content}`, "i")) ??
    html.match(new RegExp(`<meta[^>]+${content}[^>]+${attr}`, "i"));
  const v = m?.[1]?.trim();
  return v ? decodeEntities(v) : null;
}

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Extract a best-effort product preview from a marketplace item page's raw
 * HTML. Everything is optional — Taobao/1688 are heavily login/anti-bot walled
 * and often yield only nulls, which the UI handles gracefully. Pure + exported
 * so it can be unit-tested against sample HTML without a network fetch.
 */
export function extractPreview(html: string, marketplace: Marketplace): MarketplacePreview {
  const title =
    metaContent(html, "og:title") ??
    (html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ? decodeEntities(html.match(/<title>([^<]+)<\/title>/i)![1].trim()) : null);
  let image = metaContent(html, "og:image");
  if (image && image.startsWith("//")) image = `https:${image}`;
  const description = metaContent(html, "og:description") ?? "";

  // Price: explicit fields first (og:price, itemprop=price, JSON "price"),
  // then the shared CNY text heuristic over title + description.
  const explicitPrice = firstMatch(html, [
    /<meta[^>]+(?:property|itemprop)=["'](?:og:price:amount|price)["'][^>]+content=["']([\d.]+)["']/i,
    /"price"\s*:\s*"?(\d{1,7}(?:\.\d{1,2})?)"?/i,
    /"minPrice"\s*:\s*"?(\d{1,7}(?:\.\d{1,2})?)"?/i,
  ]);
  let priceCny: number | null = null;
  let priceEstimate = false;
  if (explicitPrice && Number.isFinite(Number(explicitPrice)) && Number(explicitPrice) >= 1) {
    priceCny = Number(explicitPrice);
  } else {
    const parsed = parsePriceCnyDetailed(`${title ?? ""} ${description}`);
    if (parsed) {
      priceCny = parsed.value;
      priceEstimate = parsed.estimate;
    }
  }

  // Weidian: the seller id appears as ?userid=, "userid":, or "sellerId":.
  let sellerUserId: string | null = null;
  let sellerShopUrl: string | null = null;
  if (marketplace === "weidian") {
    sellerUserId = firstMatch(html, [
      /weidian\.com\/\?userid=(\d+)/i,
      /["'](?:userid|userId|sellerId|seller_id)["']\s*:\s*["']?(\d{4,})["']?/,
    ]);
    if (sellerUserId) sellerShopUrl = `https://weidian.com/?userid=${sellerUserId}`;
  } else {
    // Taobao/Tmall shop subdomain or store hand-off, if the page exposes one.
    sellerShopUrl = firstMatch(html, [
      /(https?:\/\/[a-z0-9-]+\.(?:taobao|tmall)\.com\/[^"'\s]*shop[^"'\s]*)/i,
      /(https?:\/\/store\.taobao\.com\/[^"'\s]+)/i,
    ]);
  }

  return { title, image, priceCny, priceEstimate, sellerUserId, sellerShopUrl };
}

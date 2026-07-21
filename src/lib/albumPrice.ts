/**
 * Fetching a Yupoo album's real price. Shared by the store grid's bulk prefetch
 * and the haul price-drop check.
 *
 * The price lives in the album *description*, not its title (see AlbumModal),
 * so `&light=1` pulls just that without the photo scan.
 */

import { pickBestPrice, type ParsedPrice } from "./price";
import { cacheSet, CACHE_TTL } from "./clientCache";
import { recordPrice } from "./priceHistory";
import type { YupooAlbumLightResponse } from "./yupoo";

/**
 * A 429 is reported distinctly (with the server's Retry-After) so callers can
 * back off and retry rather than permanently showing no price; any other
 * failure resolves to a null description (price unknown).
 */
export type DescriptionResult =
  | { rateLimited: false; description: string | null; links: string[] }
  | { rateLimited: true; retryAfterMs: number };

const EMPTY: DescriptionResult = { rateLimited: false, description: null, links: [] };

export async function fetchAlbumDescription(host: string, yupooId: string): Promise<DescriptionResult> {
  try {
    const res = await fetch(`/api/yupoo/album?host=${encodeURIComponent(host)}&id=${yupooId}&light=1`);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      return {
        rateLimited: true,
        retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000,
      };
    }
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Partial<YupooAlbumLightResponse>;
    return { rateLimited: false, description: data.description ?? null, links: data.links ?? [] };
  } catch {
    return EMPTY;
  }
}

/** The cart/haul id an album maps to — also the key its price history lives under. */
export function albumItemId(host: string, yupooId: string): string {
  return `album:${host}:${yupooId}`;
}

/**
 * What a scraped album description yields, cached per album. `l` is optional so
 * entries written before links were scraped still read back as a valid price.
 */
export interface AlbumScrapeCache {
  p: ParsedPrice | null;
  /** Raw marketplace item links from the description — feed to pickMarketplaceLinks. */
  l?: string[];
}

/** Persist a resolved scrape: refresh the TTL cache and append the price to the item's history. */
export function commitAlbumPrice(
  host: string,
  yupooId: string,
  price: ParsedPrice | null,
  links: string[] = [],
): void {
  cacheSet<AlbumScrapeCache>("price", `${host}:${yupooId}`, { p: price, l: links }, CACHE_TTL.price);
  if (price) recordPrice(albumItemId(host, yupooId), price.value);
}

/**
 * Re-scrape one album's price, ignoring the TTL cache — this is the deliberate
 * "check for drops" path, so a cached copy would defeat the point. Retries a
 * rate-limited response a bounded number of times.
 */
export async function fetchAlbumPriceFresh(
  host: string,
  yupooId: string,
  opts: { fallbackText?: string; retries?: number } = {},
): Promise<ParsedPrice | null> {
  const { fallbackText = "", retries = 2 } = opts;
  let result = await fetchAlbumDescription(host, yupooId);
  for (let attempt = 0; result.rateLimited && attempt < retries; attempt++) {
    await new Promise((r) => setTimeout(r, result.rateLimited ? result.retryAfterMs : 0));
    result = await fetchAlbumDescription(host, yupooId);
  }
  // A rate-limited miss is "unknown", not "no price" — don't let it poison the history.
  if (result.rateLimited) return null;
  // Description first, then the album title (passed as fallbackText) — the price
  // may be in either, so scanning only one would drop title-only prices.
  const price = pickBestPrice(result.description, fallbackText);
  commitAlbumPrice(host, yupooId, price, result.links);
  return price;
}

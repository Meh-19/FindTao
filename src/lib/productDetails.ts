/**
 * Real product facts for a marketplace item — the title, price, weight and
 * dimensions the seller's Yupoo album can't tell you.
 *
 * Why this comes from an API rather than a scraper: the marketplaces are shut.
 * Weidian's item page returns a generic "商品详情" with no price (the real data
 * is client-rendered), Taobao returns nothing to a server fetch, and the
 * agents' own item APIs reject unsigned requests. JadeShip resolves all of them
 * and sells the result, so that's what this uses.
 *
 * It's metered per request, so cost discipline is part of the design:
 * - only the default field set is requested (description/props cost extra),
 * - a lookup fires when a shopper *opens* one album, never for a grid of them,
 * - responses are cached on the server (shared across everyone) and on the
 *   client, so the same item is paid for about once a day, not once a view.
 */

import type { Marketplace, ParsedLink } from "./links";
import { cacheGet, cacheSet, CACHE_TTL } from "./clientCache";

/** Grams. */
export type Weight = number;

export interface ProductVolume {
  length: number;
  width: number;
  height: number;
}

export interface ProductShipping {
  /** Grams, when the marketplace reports it. */
  weight: Weight | null;
  /** Centimetres. */
  volume: ProductVolume | null;
  /** CNY cost to ship inside China — the agent pays this before your parcel exists. */
  domesticFreight: number | null;
}

export interface ProductDetails {
  id: string;
  marketplace: Marketplace;
  /** The seller's real listing title (usually Chinese) — not the album name. */
  title: string | null;
  /** CNY, straight from the marketplace rather than parsed out of album text. */
  priceCny: number | null;
  thumbnailUrl: string | null;
  imgUrls: string[];
  shipping: ProductShipping;
  /** Units sold, as the marketplace reports — a rough proxy for how proven a piece is. */
  sales: number | null;
  /** When this snapshot was taken. */
  at: number;
}

/** Marketplaces the upstream API can resolve. Xianyu (goofish) isn't one of them. */
const SUPPORTED: Record<Marketplace, string | null> = {
  taobao: "taobao",
  weidian: "weidian",
  "1688": "1688",
  xianyu: null,
};

export function supportsProductDetails(marketplace: Marketplace): boolean {
  return SUPPORTED[marketplace] !== null;
}

/** Our marketplace id → the upstream's. Null when they can't resolve it. */
export function upstreamMarketplace(marketplace: Marketplace): string | null {
  return SUPPORTED[marketplace];
}

/** A weight worth showing: real grams, not a zero placeholder. */
export function hasWeight(d: ProductDetails | null): boolean {
  return d?.shipping.weight != null && d.shipping.weight > 0;
}

export function formatVolume(v: ProductVolume): string {
  return `${v.length} × ${v.width} × ${v.height} cm`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function sanitizeVolume(v: unknown): ProductVolume | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const length = num(o.length);
  const width = num(o.width);
  const height = num(o.height);
  // A partial box is not a box — all three or nothing.
  return length && width && height ? { length, width, height } : null;
}

function sanitizeShipping(v: unknown): ProductShipping {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  return { weight: num(o.weight), volume: sanitizeVolume(o.volume), domesticFreight: num(o.domesticFreight) };
}

/**
 * Coerce an upstream item payload into our shape, keeping only fields we asked
 * for. Pure + exported so it can be tested against sample payloads without a
 * network call (and without spending a metered request), the same way
 * marketplacePreview's extractPreview is.
 *
 * Zeroes become null throughout: agents report an unmeasured item as `0` grams,
 * and "0 g" on screen is worse than showing nothing.
 */
export function sanitizeProductDetails(raw: unknown, marketplace: Marketplace, id: string): ProductDetails | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = (raw as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) return null;
  const o = item as Record<string, unknown>;

  return {
    id,
    marketplace,
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 300) : null,
    priceCny: num(o.price),
    thumbnailUrl: typeof o.thumbnailUrl === "string" ? o.thumbnailUrl : null,
    imgUrls: Array.isArray(o.imgUrls) ? o.imgUrls.filter((u): u is string => typeof u === "string").slice(0, 12) : [],
    shipping: sanitizeShipping(o.shipping),
    sales: typeof o.sales === "number" && Number.isFinite(o.sales) && o.sales >= 0 ? o.sales : null,
    at: Date.now(),
  };
}

/** Why a lookup produced nothing — the UI says so rather than rendering a blank. */
export type ProductLookupError = "unsupported" | "not_configured" | "unavailable";

export type ProductLookup =
  | { ok: true; details: ProductDetails }
  | { ok: false; reason: ProductLookupError; message: string };

/**
 * Look up one item's real facts, cache-first. Every miss is a metered request,
 * so this is only ever called for an item the shopper actually opened — never
 * across a grid.
 */
export async function fetchProductDetails(link: ParsedLink): Promise<ProductLookup> {
  if (!supportsProductDetails(link.marketplace)) {
    return { ok: false, reason: "unsupported", message: `No product data for ${link.marketplace} items` };
  }

  const cacheId = `${link.marketplace}:${link.itemId}`;
  const hit = cacheGet<ProductDetails>("product", cacheId);
  if (hit) return { ok: true, details: hit };

  try {
    const res = await fetch(`/api/product/${link.marketplace}/${link.itemId}`);
    const body = (await res.json()) as ProductDetails & { error?: string; message?: string };
    if (!res.ok) {
      return {
        ok: false,
        reason: body.error === "not_configured" ? "not_configured" : "unavailable",
        message: body.message ?? "Couldn't load this item's details",
      };
    }
    cacheSet<ProductDetails>("product", cacheId, body, CACHE_TTL.product);
    return { ok: true, details: body };
  } catch {
    return { ok: false, reason: "unavailable", message: "Couldn't reach the product service" };
  }
}

/**
 * Which Yupoo listings sell the same marketplace product.
 *
 * Yupoo stores are shopfronts, not warehouses: a dozen sellers front the same
 * Taobao item at their own markup. Once an album carries a product link (see
 * pickMarketplaceLinks), sightings of one `productKey` across stores can be
 * collected — which is the difference between "¥300 at FireRep" and "¥300 at
 * FireRep, ¥255 for the identical item two stores over".
 *
 * Only stores the shopper has actually opened contribute, since that's when
 * descriptions get scraped. The index therefore grows as they browse, and
 * never claims to know the whole market — callers should phrase it as "of the
 * stores you follow", not "cheapest anywhere".
 *
 * Best-effort like the rest of the local layer: storage errors are swallowed.
 */

const KEY = "findtao:productindex";
/** Products tracked before least-recently-seen eviction. */
const MAX_PRODUCTS = 600;
/** Listings kept per product — more than a handful of sellers is already noise. */
const MAX_SIGHTINGS = 8;

export interface ProductSighting {
  storeId: string;
  storeName: string;
  /** Yupoo host + album id — enough to deep-link straight to the listing. */
  host: string;
  yupooId: string;
  title: string;
  /** The seller's asking price, or null when their listing didn't state one. */
  priceCny: number | null;
  /** When this listing was last seen — an index entry can outlive the album. */
  at: number;
}

type Index = Record<string, ProductSighting[]>;

function readAll(): Index {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Index) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(index: Index): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(index));
  } catch {
    /* quota or storage disabled — the cross-store view is a bonus, not a dependency */
  }
}

function evict(index: Index): Index {
  const keys = Object.keys(index);
  if (keys.length <= MAX_PRODUCTS) return index;
  const lastSeen = (k: string) => Math.max(...index[k].map((s) => s.at), 0);
  const keep = keys.sort((a, b) => lastSeen(b) - lastSeen(a)).slice(0, MAX_PRODUCTS);
  const next: Index = {};
  for (const k of keep) next[k] = index[k];
  return next;
}

/**
 * Record that a listing sells a product. Re-recording the same album updates it
 * in place (prices move), so an album never appears twice under one product.
 */
export function recordSightings(entries: { key: string; sighting: ProductSighting }[]): void {
  if (entries.length === 0) return;
  const index = readAll();
  let changed = false;

  for (const { key, sighting } of entries) {
    const existing = index[key] ?? [];
    const at = existing.findIndex((s) => s.host === sighting.host && s.yupooId === sighting.yupooId);
    if (at >= 0) {
      const prev = existing[at];
      // Skip a no-op rewrite so a store revisit doesn't churn localStorage.
      if (prev.priceCny === sighting.priceCny && prev.title === sighting.title) continue;
      existing[at] = sighting;
    } else {
      existing.push(sighting);
    }
    // Newest first, capped.
    index[key] = existing.sort((a, b) => b.at - a.at).slice(0, MAX_SIGHTINGS);
    changed = true;
  }

  if (changed) writeAll(evict(index));
}

/** Every listing known to sell this product, newest sighting first. */
export function getSightings(key: string): ProductSighting[] {
  return readAll()[key] ?? [];
}

/**
 * *Other stores* selling the same product, cheapest first.
 *
 * The whole current store is excluded, not just the album being viewed: one
 * marketplace listing legitimately backs several albums in a single store,
 * because colourways are a variant picked at checkout rather than separate
 * items ("Tracksuit red" and "Tracksuit navy" are one Taobao id). Those aren't
 * a competing offer — showing a store its own other colourway as an
 * alternative would be nonsense. Only one entry per rival store survives, for
 * the same reason.
 */
export function otherSellers(key: string, self: { storeId: string }): ProductSighting[] {
  const seenStores = new Set<string>();
  const out: ProductSighting[] = [];
  for (const s of getSightings(key)) {
    if (s.storeId === self.storeId || seenStores.has(s.storeId)) continue;
    seenStores.add(s.storeId);
    out.push(s);
  }
  // Cheapest first — that's the question being asked. Unpriced listings sink.
  return out.sort((a, b) => (a.priceCny ?? Infinity) - (b.priceCny ?? Infinity));
}

/** Batch lookup of how many listings each product has, for grid badges. */
export function sightingCounts(keys: string[]): Record<string, number> {
  const all = readAll();
  const out: Record<string, number> = {};
  for (const k of keys) {
    const stores = new Set((all[k] ?? []).map((s) => s.storeId));
    out[k] = stores.size;
  }
  return out;
}

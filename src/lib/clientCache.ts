/**
 * Small localStorage-backed cache for scraped Yupoo data — album listings,
 * per-album prices, and photo lists. Lets a revisited store paint instantly
 * from disk while a background refetch keeps it fresh (stale-while-revalidate),
 * and lets the expensive per-album price lookups be skipped entirely within
 * their TTL.
 *
 * Everything here is best-effort: entries carry a TTL, the store is capped and
 * evicts oldest-first, and any read/write/quota error is swallowed so a full
 * (or disabled) localStorage never breaks a page — it just falls back to the
 * network path it already had.
 */

const PREFIX = "findtao:cache:";
/**
 * Soft cap on cached blobs before oldest-first eviction kicks in.
 *
 * BUG FIX: this was 220, which was below the cost of a *single* store — one
 * Yupoo store writes ~121 entries (a price per album on the first page, plus
 * the listing). Visiting a second store therefore evicted the first one's
 * prices immediately, so every revisit re-scraped 120 descriptions and showed
 * blank prices until they landed. A price entry is ~140 bytes, so ten stores
 * is ~160KB against a ~5MB budget: the entry count was never the real limit.
 * The byte budget below is, and quota errors are still caught either way.
 */
const MAX_ENTRIES = 2000;
/** Rough ceiling on total cached bytes, well under a typical 5MB origin quota. */
const MAX_BYTES = 3_000_000;

interface Entry<T> {
  ts: number;
  ttl: number;
  v: T;
}

/** TTLs in ms. Prices/photos are effectively static; listings change when new drops land. */
export const CACHE_TTL = {
  albums: 12 * 3600_000,
  price: 24 * 3600_000,
  photos: 24 * 3600_000,
  /** Product facts are metered per lookup — cache them as long as the server does. */
  product: 24 * 3600_000,
} as const;

function fullKey(ns: string, id: string): string {
  return `${PREFIX}${ns}:${id}`;
}

function cacheKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
  } catch {
    /* localStorage unavailable (SSR / private mode) */
  }
  return keys;
}

function evictOldest(count: number): void {
  const scored = cacheKeys().map((key) => {
    let ts = 0;
    try {
      ts = (JSON.parse(localStorage.getItem(key) ?? "{}") as { ts?: number }).ts ?? 0;
    } catch {
      /* corrupt entry sorts as oldest and gets dropped first */
    }
    return { key, ts };
  });
  scored.sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < count && i < scored.length; i++) {
    try {
      localStorage.removeItem(scored[i].key);
    } catch {
      /* ignore */
    }
  }
}

/** Read a cached value, or null on a miss / expired entry / unavailable storage. */
export function cacheGet<T>(ns: string, id: string): T | null {
  try {
    const raw = localStorage.getItem(fullKey(ns, id));
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    if (!e || typeof e.ts !== "number" || Date.now() - e.ts > e.ttl) {
      try {
        localStorage.removeItem(fullKey(ns, id));
      } catch {
        /* ignore */
      }
      return null;
    }
    return e.v;
  } catch {
    return null;
  }
}

/**
 * Bring the store back under its caps. Enumerating localStorage costs a sync
 * call per key, so this runs periodically rather than on every write — a store
 * page writes ~120 entries in a burst, and sweeping each time made every write
 * walk the whole store.
 */
function sweep(): void {
  const keys = cacheKeys();
  if (keys.length > MAX_ENTRIES) {
    evictOldest(keys.length - MAX_ENTRIES);
    return;
  }
  // Bytes are the real limit; only worth measuring once the store is sizeable.
  if (keys.length < MAX_ENTRIES / 2) return;
  let bytes = 0;
  for (const key of keys) bytes += (localStorage.getItem(key) ?? "").length;
  if (bytes > MAX_BYTES) evictOldest(Math.ceil(keys.length / 4));
}

let writesSinceSweep = 0;
/** Writes between sweeps — small enough to stay bounded, large enough to stay cheap. */
const SWEEP_EVERY = 50;

/** Write a value with a TTL. Oldest entries are evicted when capped or over quota. */
export function cacheSet<T>(ns: string, id: string, v: T, ttlMs: number): void {
  const key = fullKey(ns, id);
  const payload = JSON.stringify({ ts: Date.now(), ttl: ttlMs, v } as Entry<T>);
  try {
    localStorage.setItem(key, payload);
    if (++writesSinceSweep >= SWEEP_EVERY) {
      writesSinceSweep = 0;
      sweep();
    }
  } catch {
    // Quota hit (or storage disabled) — drop the oldest quarter and retry once.
    try {
      evictOldest(Math.ceil(cacheKeys().length / 4) + 1);
      localStorage.setItem(key, payload);
    } catch {
      /* give up — caching is a best-effort speedup */
    }
  }
}

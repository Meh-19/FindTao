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
/** Soft cap on cached blobs before oldest-first eviction kicks in. */
const MAX_ENTRIES = 220;

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

/** Write a value with a TTL, evicting oldest entries if capped or over quota. */
export function cacheSet<T>(ns: string, id: string, v: T, ttlMs: number): void {
  const key = fullKey(ns, id);
  const payload = JSON.stringify({ ts: Date.now(), ttl: ttlMs, v } as Entry<T>);
  try {
    const keys = cacheKeys();
    if (keys.length >= MAX_ENTRIES && !keys.includes(key)) {
      evictOldest(keys.length - MAX_ENTRIES + 1);
    }
    localStorage.setItem(key, payload);
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

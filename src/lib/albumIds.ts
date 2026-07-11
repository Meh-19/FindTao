/**
 * Client-side fetch of a Yupoo store's current album ids (page 1 — where the
 * newest albums live). Cached with a short TTL and throttled to a few in flight
 * so the Library page can check many followed stores for new releases without
 * stampeding the scraping proxy.
 */

interface CacheEntry {
  ids: string[];
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 10 * 60_000;
const MAX_CONCURRENT = 4;

let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  const next = queue.shift();
  if (next) next();
  else active--;
}

export async function fetchAlbumIds(host: string): Promise<string[]> {
  const cached = cache.get(host);
  if (cached && Date.now() - cached.ts < TTL) return cached.ids;

  await acquire();
  try {
    const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(host)}&page=1`);
    if (!res.ok) return cached?.ids ?? [];
    const data = (await res.json()) as { albums?: { id: string }[] };
    const ids = (data.albums ?? []).map((a) => a.id).filter(Boolean);
    cache.set(host, { ids, ts: Date.now() });
    return ids;
  } catch {
    return cached?.ids ?? [];
  } finally {
    release();
  }
}

/**
 * Client-side fetch of a Yupoo store's current album ids (page 1 — where the
 * newest albums live). Cached with a short TTL and throttled to a few in flight
 * so the Library page can check many followed stores for new releases without
 * stampeding the scraping proxy.
 */

import type { StoreInfo } from "@/data/stores";
import { localAlbumId, yupooHostOf } from "./yupooStores";

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

/**
 * When the shopper follows a store, treat everything currently posted as
 * already-seen so only *future* drops surface as "new". Without this, a
 * freshly-followed store has no seen-record and its whole catalog reads as a
 * pile of new drops. No-op for non-Yupoo stores (they have no album feed).
 */
export async function baselineStoreOnFollow(
  store: StoreInfo,
  markStoreSeen: (storeId: string, ids: string[]) => void,
): Promise<void> {
  const host = yupooHostOf(store.url);
  if (!host) return;
  const ids = await fetchAlbumIds(host);
  if (ids.length) markStoreSeen(store.id, ids.map(localAlbumId));
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

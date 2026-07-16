/** Resolving the user's followed Yupoo stores — shared by Browse's album search and the drops feed. */

import type { StoreInfo } from "@/data/stores";

export interface YupooStoreRef {
  /** Yupoo subdomain, e.g. "firerep". */
  host: string;
  /** FindTao store id, for /store/<id> links. */
  id: string;
  name: string;
}

/** `https://firerep.x.yupoo.com/...` → `firerep`. */
export function yupooHostOf(url: string): string | null {
  return url.match(/([a-z0-9-]+)\.x\.yupoo\.com/i)?.[1]?.toLowerCase() ?? null;
}

/**
 * Every Yupoo store in the shopper's library, deduped by host — two library
 * entries pointing at the same Yupoo account would otherwise be scraped twice.
 */
export function libraryYupooStores(allStores: StoreInfo[], library: string[]): YupooStoreRef[] {
  const out: YupooStoreRef[] = [];
  const seen = new Set<string>();
  for (const s of allStores) {
    if (!library.includes(s.id)) continue;
    const host = yupooHostOf(s.url);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push({ host, id: s.id, name: s.name });
  }
  return out;
}

/** The local Album id a scraped Yupoo album maps to — the key `storeSeen` tracks. */
export function localAlbumId(yupooAlbumId: string): string {
  return `yupoo-${yupooAlbumId}`;
}

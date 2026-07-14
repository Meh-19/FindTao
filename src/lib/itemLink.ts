import type { SavedItem } from "./store";

export interface ItemLinkTarget {
  href: string;
  /** True for outbound links (open in a new tab); false for in-app routes. */
  external: boolean;
}

const ALBUM_ID_RE = /^album:([a-z0-9-]+):(\d+)$/i;
const CAT_ID_RE = /^cat:(.+)$/;

/**
 * The canonical destination for a saved cart/haul item — the exact product,
 * not just its store. Album-backed items deep-link to the store page with that
 * album opened (`/store/{storeId}?album={albumId}`); catalog items go to their
 * detail page; anything else falls back to its raw marketplace url. Returns
 * null only when there's nothing better than the store to point at.
 */
export function itemHref(item: Pick<SavedItem, "id" | "storeId" | "url">): ItemLinkTarget | null {
  const album = item.id.match(ALBUM_ID_RE);
  if (album) {
    const [, host, albumId] = album;
    if (item.storeId) return { href: `/store/${item.storeId}?album=${albumId}`, external: false };
    // No known store (e.g. added via a pasted URL) — open the Yupoo album directly.
    return { href: `https://${host}.x.yupoo.com/albums/${albumId}`, external: true };
  }
  const cat = item.id.match(CAT_ID_RE);
  if (cat) return { href: `/item/${cat[1]}`, external: false };
  if (item.url) return { href: item.url, external: true };
  return null;
}

import type { SavedItem } from "@/lib/store";

/** Everything needed to open an album in the shared preview modal. */
export interface AlbumPreviewTarget {
  storeId: string;
  /** Yupoo album id (the numeric part of `album:<host>:<id>`). */
  yupooId: string;
  name?: string;
  cover?: string | null;
  photoCount?: number;
}

const ALBUM_ID_RE = /^album:([a-z0-9-]+):(\d+)$/i;

/**
 * Resolve a saved cart/haul line to a preview target, or null when it isn't a
 * previewable Yupoo album (e.g. a catalog item or a raw pasted URL). Only album
 * lines with a known store can be shown in the modal.
 */
export function albumPreviewTarget(
  item: Pick<SavedItem, "id" | "storeId" | "title" | "image">,
  hasStore: (id: string) => boolean,
): AlbumPreviewTarget | null {
  const m = item.id.match(ALBUM_ID_RE);
  if (!m || !item.storeId || !hasStore(item.storeId)) return null;
  return { storeId: item.storeId, yupooId: m[2], name: item.title, cover: item.image };
}

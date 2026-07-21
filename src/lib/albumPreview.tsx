"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Album } from "@/data/albums";
import type { SavedItem } from "@/lib/store";
import { useStore } from "@/lib/store";
import { detectStorePlatform } from "@/lib/platform";
import { AlbumModal } from "@/components/AlbumModal";

/** Everything needed to open an album in the shared preview modal. */
export interface AlbumPreviewTarget {
  storeId: string;
  /** Yupoo album id (the numeric part of `album:<host>:<id>`). */
  yupooId: string;
  name?: string;
  cover?: string | null;
  photoCount?: number;
}

interface PreviewApi {
  openPreview: (target: AlbumPreviewTarget) => void;
}

const Ctx = createContext<PreviewApi | null>(null);

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

/**
 * Hosts a single AlbumModal that any component can open — so clicking a piece in
 * the cart, drops feed or a haul opens its photos in place instead of yanking
 * the shopper off to the whole store page.
 */
export function AlbumPreviewProvider({ children }: { children: ReactNode }) {
  const { allStores } = useStore();
  const [target, setTarget] = useState<AlbumPreviewTarget | null>(null);

  const openPreview = useCallback((t: AlbumPreviewTarget) => setTarget(t), []);
  const api = useMemo<PreviewApi>(() => ({ openPreview }), [openPreview]);

  const store = target ? allStores.find((s) => s.id === target.storeId) : undefined;
  const host =
    store && detectStorePlatform(store.url).platform === "yupoo"
      ? (detectStorePlatform(store.url).yupooHost ?? null)
      : null;
  const album: Album | null =
    target && store
      ? {
          id: `yupoo-${target.yupooId}`,
          yupooId: target.yupooId,
          name: target.name ?? "",
          photoCount: target.photoCount ?? 0,
          cover: target.cover ?? null,
          hue: store.hue,
        }
      : null;

  return (
    <Ctx.Provider value={api}>
      {children}
      {store && album && (
        <AlbumModal store={store} album={album} host={host} onClose={() => setTarget(null)} />
      )}
    </Ctx.Provider>
  );
}

/** Access the shared preview opener. Returns null outside the provider. */
export function useAlbumPreview(): PreviewApi | null {
  return useContext(Ctx);
}

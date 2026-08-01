"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Album } from "@/data/albums";
import { useStore } from "@/lib/store";
import { detectStorePlatform } from "@/lib/platform";
import { AlbumModal } from "@/components/AlbumModal";
import { albumPreviewTarget, type AlbumPreviewTarget } from "@/lib/albumPreviewTarget";

// Re-exported so existing importers (ItemLink) keep their single import site.
export { albumPreviewTarget };
export type { AlbumPreviewTarget };

interface PreviewApi {
  openPreview: (target: AlbumPreviewTarget) => void;
}

const Ctx = createContext<PreviewApi | null>(null);

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

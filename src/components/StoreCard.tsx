"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Plus, Star } from "lucide-react";
import type { StoreInfo } from "@/data/stores";
import { storeItems } from "@/data/catalog";
import { storeAlbums } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { fetchAlbumIds } from "@/lib/albumIds";
import { StoreAvatar } from "@/components/StoreAvatar";
import { useStore } from "@/lib/store";

export function StoreCard({ store, index = 0 }: { store: StoreInfo; index?: number }) {
  const { inLibrary, addToLibrary, removeFromLibrary, favStores, toggleFavStore, toast, hydrated, tagDefs, catalogItems, storeSeen } = useStore();
  const storeTagDefs = tagDefs.filter((t) => t.kind === "store" && store.tags?.includes(t.name));
  const saved = hydrated && inLibrary(store.id);
  const fav = hydrated && favStores.includes(store.id);
  const itemCount = storeItems(catalogItems, store.id).length;
  // BUG FIX: store.albums was a hardcoded 0 from the directory row (Supabase
  // doesn't track a live album count), so every card read "0 albums"
  // regardless of what the store actually has. Yupoo stores load their real
  // album count only once you open the store page (it requires a network
  // fetch), so here we read the deterministic placeholder album list length
  // for non-Yupoo stores and label Yupoo stores as "Live on Yupoo" instead
  // of asserting a count we don't actually have.
  const platform = detectStorePlatform(store.url);
  const albumCount = platform.platform === "yupoo" ? null : storeAlbums(store).length;

  // "New releases": lazily (once the card scrolls into view) fetch the store's
  // current album ids and count how many the user hasn't seen. Yupoo only.
  const yupooHost = platform.platform === "yupoo" ? platform.yupooHost : undefined;
  const cardRef = useRef<HTMLDivElement>(null);
  const [currentIds, setCurrentIds] = useState<string[] | null>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!hydrated || !yupooHost || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          io.disconnect();
          fetchAlbumIds(yupooHost).then(setCurrentIds);
        }
      },
      { rootMargin: "250px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, yupooHost]);
  const newCount = useMemo(() => {
    if (!currentIds) return 0;
    const seen = new Set(storeSeen[store.id] ?? []);
    return currentIds.filter((id) => !seen.has(id)).length;
  }, [currentIds, storeSeen, store.id]);

  return (
    <div
      ref={cardRef}
      className="card-pop fade-up rounded-none border border-white/5 bg-ink-800/80 p-4"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="flex items-start gap-3">
        <Link href={`/store/${store.id}`} className="shrink-0">
          <StoreAvatar store={store} className="h-11 w-11 rounded-none text-xs shadow-hard-sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/store/${store.id}`} className="block truncate text-sm font-semibold text-mist-100 hover:underline">
            {store.name}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs text-mist-500">{store.blurb}</p>
        </div>
        <button
          onClick={() => toggleFavStore(store.id)}
          aria-label={fav ? "Unfavorite store" : "Favorite store"}
          aria-pressed={fav}
          className={`p-1 transition-colors ${fav ? "text-warning" : "text-mist-500 hover:text-warning"}`}
        >
          <Star size={16} aria-hidden="true" className={fav ? "fill-current" : ""} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {storeTagDefs.map((t) => (
          <span
            key={t.id}
            className="rounded-none border px-2 py-0.5 font-medium"
            style={{ borderColor: `${t.color}99`, background: `${t.color}22`, color: t.color }}
          >
            {t.name}
          </span>
        ))}
        {store.categories.map((c) => (
          <span key={c} className="rounded-none border border-white/5 bg-ink-700 px-2 py-0.5 text-mist-400">
            {c}
          </span>
        ))}
        <span className="rounded-none border border-neon-400/20 bg-neon-500/10 px-2 py-0.5 text-neon-300">
          Trust {store.trust}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-mist-500">
        <span className="flex items-center gap-2">
          <span>
            {albumCount === null ? "Live on Yupoo" : `${albumCount} album${albumCount === 1 ? "" : "s"}`}
            {itemCount > 0 && ` · ${itemCount} indexed`}
          </span>
          {newCount > 0 && (
            <Link
              href={`/store/${store.id}`}
              className="rounded-none border border-neon-400/60 bg-neon-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon-200 shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-colors hover:bg-neon-500/30"
            >
              +{newCount} New!
            </Link>
          )}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/store/${store.id}`}
            className="btn-glow flex items-center gap-1 rounded-none px-3 py-1.5 font-semibold text-white"
          >
            Browse <ArrowRight size={12} aria-hidden="true" />
          </Link>
          {saved ? (
            <button
              onClick={() => { removeFromLibrary(store.id); toast(`${store.name} removed from library`, "info"); }}
              className="flex items-center gap-1 rounded-none border border-success/40 bg-success/10 px-3 py-1.5 font-medium text-success transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <Check size={12} aria-hidden="true" /> In library
            </button>
          ) : (
            <button
              onClick={() => { addToLibrary(store.id); toast(`${store.name} added to library`); }}
              className="flex items-center gap-1 rounded-none border border-ink-500 px-3 py-1.5 font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
            >
              <Plus size={12} aria-hidden="true" /> Library
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

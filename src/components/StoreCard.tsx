"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus, Star } from "lucide-react";
import type { StoreInfo } from "@/data/stores";
import { storeItems } from "@/data/catalog";
import { storeAlbums } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { useStore } from "@/lib/store";

export function StoreCard({ store, index = 0 }: { store: StoreInfo; index?: number }) {
  const { inLibrary, addToLibrary, removeFromLibrary, favStores, toggleFavStore, toast, hydrated, tagDefs, catalogItems } = useStore();
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

  return (
    <div
      className="card-pop fade-up rounded-none border border-white/5 bg-ink-800/80 p-4"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/store/${store.id}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none text-xs font-bold text-white shadow-hard-sm"
          style={{ background: "#1a1a1a" }}
        >
          {store.name.slice(0, 2).toUpperCase()}
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
          className={`p-1 transition-colors ${fav ? "text-amber-300" : "text-mist-500 hover:text-amber-300"}`}
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
        <span>
          {albumCount === null ? "Live on Yupoo" : `${albumCount} album${albumCount === 1 ? "" : "s"}`}
          {itemCount > 0 && ` · ${itemCount} indexed`}
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
              className="flex items-center gap-1 rounded-none border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-medium text-emerald-300 transition-colors hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300"
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

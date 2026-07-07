"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Images, Plus, Star } from "lucide-react";
import { storeItems } from "@/data/catalog";
import { storeAlbums, type Album } from "@/data/albums";
import { AlbumModal } from "./AlbumModal";
import { ItemCard } from "./ItemCard";
import { useStore } from "@/lib/store";

export function StoreView({ id }: { id: string }) {
  const {
    allStores, inLibrary, addToLibrary, removeFromLibrary,
    favStores, toggleFavStore, toast, hydrated, tagDefs,
  } = useStore();
  const store = allStores.find((s) => s.id === id);
  const items = storeItems(id);
  const albums = useMemo(() => (store ? storeAlbums(store) : []), [store]);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);

  if (!hydrated) return null;
  if (!store) {
    return (
      <div className="fade-up rounded-2xl border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
        Store not found. <Link href="/discover" className="text-neon-300 underline">Back to Discover</Link>
      </div>
    );
  }

  const saved = inLibrary(store.id);
  const fav = favStores.includes(store.id);

  return (
    <div className="fade-up">
      <Link href="/library" className="inline-flex items-center gap-1 text-sm text-mist-500 transition-colors hover:text-mist-100">
        <ArrowLeft size={14} aria-hidden="true" /> Library
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-ink-800/80 p-5">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${store.hue[0]}, ${store.hue[1]})` }}
        >
          {store.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-mist-100">
            {store.name}
            <button
              onClick={() => toggleFavStore(store.id)}
              aria-label={fav ? "Unfavorite store" : "Favorite store"}
              aria-pressed={fav}
              className={`p-0.5 ${fav ? "text-amber-300" : "text-mist-500 hover:text-amber-300"}`}
            >
              <Star size={16} aria-hidden="true" className={fav ? "fill-current" : ""} />
            </button>
          </h1>
          <p className="mt-0.5 text-sm text-mist-400">{store.blurb}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {tagDefs
              .filter((t) => t.kind === "store" && store.tags?.includes(t.name))
              .map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border px-2 py-0.5 font-medium"
                  style={{ borderColor: `${t.color}99`, background: `${t.color}22`, color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            {store.categories.map((c) => (
              <span key={c} className="rounded-full border border-white/5 bg-ink-700 px-2 py-0.5 text-mist-400">
                {c}
              </span>
            ))}
            <span className="rounded-full border border-neon-400/20 bg-neon-500/10 px-2 py-0.5 text-neon-300">
              Trust {store.trust}/100
            </span>
            <a
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-mist-500 underline decoration-ink-500 hover:text-neon-300"
            >
              source <ExternalLink size={10} aria-hidden="true" />
            </a>
          </div>
        </div>
        {saved ? (
          <button
            onClick={() => { removeFromLibrary(store.id); toast(`${store.name} removed from library`, "info"); }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300"
          >
            <Check size={14} aria-hidden="true" /> In library
          </button>
        ) : (
          <button
            onClick={() => { addToLibrary(store.id); toast(`${store.name} added to library`); }}
            className="btn-glow flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={14} aria-hidden="true" /> Add to library
          </button>
        )}
      </div>

      {albums.length > 0 && (
        <>
          <h2 className="mb-4 mt-8 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
            Albums ({albums.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {albums.map((album, i) => (
              <button
                key={album.id}
                onClick={() => setOpenAlbum(album)}
                className="card-pop fade-up overflow-hidden rounded-2xl border border-white/5 bg-ink-800/80 text-left"
                style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
              >
                <div
                  className="tile-shimmer flex aspect-[4/3] items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${album.hue[0]}, ${album.hue[1]})` }}
                >
                  <Images size={22} aria-hidden="true" className="text-white/70" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-mist-100">{album.name}</p>
                  <p className="mt-0.5 text-[11px] text-mist-500">{album.photoCount} photos</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-4 mt-8 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
        Indexed items ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          Nothing indexed from this store yet — items land here as the catalog pipeline picks them up.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}

      {openAlbum && <AlbumModal store={store} album={openAlbum} onClose={() => setOpenAlbum(null)} />}
    </div>
  );
}

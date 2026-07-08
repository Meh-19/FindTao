"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Link2, Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { Album } from "@/data/albums";
import type { StoreInfo } from "@/data/stores";
import { parseLink } from "@/lib/links";
import { parsePriceCny } from "@/lib/price";
import { proxiedImg, type YupooPhotosResponse } from "@/lib/yupoo";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { AgentActions } from "./AgentActions";

/**
 * Album browser — opens as a modal over the store view. Live Yupoo albums
 * fetch their real photos through the scraping API; placeholder albums fall
 * back to gradient tiles. Grid → full viewer with arrows/Esc.
 */
export function AlbumModal({
  store,
  album,
  host,
  onClose,
}: {
  store: StoreInfo;
  album: Album;
  /** Yupoo subdomain when this store's albums are live; null for placeholders. */
  host: string | null;
  onClose: () => void;
}) {
  const { addToCart, fmtConverted, toast } = useStore();
  const [viewer, setViewer] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const live = Boolean(host && album.yupooId);
  // null = loading, [] = failed or empty (falls back to placeholder tiles)
  const [photos, setPhotos] = useState<string[] | null>(live ? null : []);
  const [itemLinks, setItemLinks] = useState<string[]>([]);

  const priceCny = useMemo(() => parsePriceCny(album.name), [album.name]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    fetch(`/api/yupoo/album?host=${encodeURIComponent(host!)}&id=${album.yupooId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: YupooPhotosResponse) => {
        if (cancelled) return;
        setPhotos(data.photos ?? []);
        setItemLinks(data.links ?? []);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [live, host, album.yupooId]);

  // Sellers often paste the item's marketplace link into the album
  // description — when one parses, offer the agent hand-off right here.
  const marketplaceLink = useMemo(() => {
    for (const raw of itemLinks) {
      const parsed = parseLink(raw);
      if (parsed) return parsed;
    }
    return null;
  }, [itemLinks]);

  const total = photos && photos.length > 0 ? photos.length : Math.max(album.photoCount, 1);
  const loading = photos === null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Esc backs out one level: viewer first, then the modal itself.
        if (viewer === null) onClose();
        else setViewer(null);
      }
      if (viewer !== null) {
        if (e.key === "ArrowRight") setViewer((v) => ((v ?? 0) + 1) % total);
        if (e.key === "ArrowLeft") setViewer((v) => ((v ?? 0) - 1 + total) % total);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer, total, onClose]);

  // Lock page scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function tileStyle(i: number) {
    const angle = 100 + ((i * 47) % 160);
    return {
      background: `linear-gradient(${angle}deg, ${album.hue[0]}${i % 2 ? "cc" : "99"}, ${album.hue[1]}${i % 3 ? "bb" : "88"}), #151024`,
    };
  }

  const gridItems = loading
    ? Array.from({ length: Math.min(album.photoCount || 8, 12) }, () => null)
    : photos!.length > 0
      ? photos!
      : Array.from({ length: total }, () => null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${album.name} album`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fade-up flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flow-bg h-0.5 shrink-0" />
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${store.hue[0]}, ${store.hue[1]})` }}
            >
              {store.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">{album.name}</p>
              <p className="text-[11px] text-mist-500">
                {store.name} · {loading ? "loading…" : `${total} photos`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close album"
            className="rounded-lg p-1.5 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gridItems.map((photo, i) => (
              <button
                key={i}
                onClick={() => !loading && setViewer(i)}
                aria-label={`Open photo ${i + 1}`}
                className="tile-shimmer aspect-square overflow-hidden rounded-lg border border-white/5 transition-transform duration-200 hover:scale-[1.03]"
                style={photo ? undefined : tileStyle(i)}
              >
                {photo && (
                  <img
                    src={proxiedImg(photo, host!)}
                    alt={`${album.name} photo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
          {!live && (
            <p className="mt-4 text-center text-[11px] text-mist-500">
              Placeholder tiles — live photos load for Yupoo stores.
            </p>
          )}
          {live && !loading && photos!.length === 0 && (
            <p className="mt-4 text-center text-[11px] text-mist-500">
              Couldn&apos;t load this album&apos;s photos — open the store on Yupoo instead.
            </p>
          )}
        </div>

        {live && (
          <div className="shrink-0 space-y-2.5 border-t border-white/5 px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {priceCny !== null ? (
                  <p className="text-lg font-extrabold tabular-nums text-mist-100">
                    {formatMoney(priceCny, "CNY")}{" "}
                    <span className="flow-text text-sm font-bold">≈ {fmtConverted(priceCny)}</span>
                  </p>
                ) : (
                  <p className="text-sm text-mist-500">Price not listed — check with your agent</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-ink-500">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="px-2.5 py-2 text-mist-400 transition-colors hover:text-white"
                  >
                    <Minus size={13} aria-hidden="true" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-mist-100">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                    className="px-2.5 py-2 text-mist-400 transition-colors hover:text-white"
                  >
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    addToCart(
                      {
                        id: `album:${host}:${album.yupooId}`,
                        title: album.name,
                        priceCny,
                        image: photos?.[0] ?? album.cover ?? null,
                        imgHost: host,
                        storeId: store.id,
                        storeName: store.name,
                        url: marketplaceLink?.rawUrl ?? null,
                      },
                      qty,
                    );
                    toast(`Added ${qty} × ${album.name.slice(0, 40)} to cart`);
                    setQty(1);
                  }}
                  className="btn-glow flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                >
                  <ShoppingCart size={14} aria-hidden="true" /> Add to cart
                </button>
              </div>
            </div>

            {marketplaceLink && (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <AgentActions link={marketplaceLink} dropUp />
                </div>
                <Link
                  href={`/convert?link=${encodeURIComponent(marketplaceLink.rawUrl)}`}
                  onClick={onClose}
                  aria-label="Open in converter"
                  className="rounded-xl border border-ink-500 p-2.5 text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300"
                >
                  <Link2 size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {viewer !== null && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/85 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setViewer(null);
          }}
        >
          <div
            className="fade-up w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-mist-400">
                <Images size={13} aria-hidden="true" />
                {album.name} · {viewer + 1} / {total}
              </p>
              <button
                onClick={() => setViewer(null)}
                aria-label="Close viewer"
                className="rounded px-2 py-1 text-mist-400 hover:text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div
              className="flex aspect-square items-center justify-center bg-ink-950"
              style={photos && photos[viewer] ? undefined : tileStyle(viewer)}
            >
              {photos && photos[viewer] ? (
                <img
                  src={proxiedImg(photos[viewer], host!)}
                  alt={`${album.name} photo ${viewer + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/80">
                  Photo placeholder
                </span>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setViewer((viewer - 1 + total) % total)}
                className="flex items-center gap-1 rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-neon-500/60 hover:text-neon-300"
              >
                <ChevronLeft size={13} aria-hidden="true" /> Prev
              </button>
              <span className="text-[11px] text-mist-500">Esc to close · arrows to flip</span>
              <button
                onClick={() => setViewer((viewer + 1) % total)}
                className="flex items-center gap-1 rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-neon-500/60 hover:text-neon-300"
              >
                Next <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

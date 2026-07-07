"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import type { Album } from "@/data/albums";
import type { StoreInfo } from "@/data/stores";

/**
 * Album browser — opens as a modal over the store view. Photo tiles are
 * gradient placeholders until the real image pipeline lands; the grid → full
 * viewer interaction (click, arrows, Esc) is the final behavior.
 */
export function AlbumModal({
  store,
  album,
  onClose,
}: {
  store: StoreInfo;
  album: Album;
  onClose: () => void;
}) {
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Esc backs out one level: viewer first, then the modal itself.
        if (viewer === null) onClose();
        else setViewer(null);
      }
      if (viewer !== null) {
        if (e.key === "ArrowRight") setViewer((v) => ((v ?? 0) + 1) % album.photoCount);
        if (e.key === "ArrowLeft") setViewer((v) => ((v ?? 0) - 1 + album.photoCount) % album.photoCount);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer, album.photoCount, onClose]);

  // Lock page scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function tile(i: number) {
    const angle = 100 + ((i * 47) % 160);
    return {
      background: `linear-gradient(${angle}deg, ${album.hue[0]}${i % 2 ? "cc" : "99"}, ${album.hue[1]}${i % 3 ? "bb" : "88"}), #151024`,
    };
  }

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
                {store.name} · {album.photoCount} photos
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
            {Array.from({ length: album.photoCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setViewer(i)}
                aria-label={`Open photo ${i + 1}`}
                className="tile-shimmer aspect-square rounded-lg border border-white/5 transition-transform duration-200 hover:scale-[1.03]"
                style={tile(i)}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-mist-500">
            Placeholder tiles — real Yupoo photos land with the data pipeline.
          </p>
        </div>
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
                {album.name} · {viewer + 1} / {album.photoCount}
              </p>
              <button
                onClick={() => setViewer(null)}
                aria-label="Close viewer"
                className="rounded px-2 py-1 text-mist-400 hover:text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="tile-shimmer flex aspect-square items-center justify-center" style={tile(viewer)}>
              <span className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/80">
                Photo placeholder
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setViewer((viewer - 1 + album.photoCount) % album.photoCount)}
                className="flex items-center gap-1 rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-neon-500/60 hover:text-neon-300"
              >
                <ChevronLeft size={13} aria-hidden="true" /> Prev
              </button>
              <span className="text-[11px] text-mist-500">Esc to close · arrows to flip</span>
              <button
                onClick={() => setViewer((viewer + 1) % album.photoCount)}
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

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  /** Proxied/display src actually rendered in the <img>. */
  src: string;
  /** Raw, unproxied source URL — shown in the micro-label so users can grab the original. */
  rawSrc: string;
  alt: string;
}

/**
 * UI FIX: dedicated lightbox/modal system for viewing a full product image.
 * Previously each caller (AlbumModal, ItemDetail) hand-rolled its own
 * viewer, several of which forced `aspect-square` on the container — that
 * cropped/stretched non-square photos. This component always uses
 * `object-contain` with `max-h-[80vh]` so the whole image is visible at its
 * native aspect ratio, and reports the real pixel dimensions + raw link
 * underneath once the image loads.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  title,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  title?: string;
}) {
  const total = images.length;
  const current = images[index];
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Dimensions are per-image — reset while the next one loads.
  useEffect(() => {
    setDims(null);
  }, [current?.src]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && total > 1) onIndexChange((index + 1) % total);
      if (e.key === "ArrowLeft" && total > 1) onIndexChange((index - 1 + total) % total);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, onIndexChange, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Image viewer"}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="fade-up flex w-full max-w-3xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full items-center justify-between pb-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-mist-400">
            {title ? `${title} · ` : ""}
            {index + 1} / {total}
          </p>
          <button
            onClick={onClose}
            aria-label="Close image viewer"
            className="border border-ink-500 p-1.5 text-mist-300 transition-colors hover:border-white hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* UI FIX: object-contain + max-h-[80vh] — never crops or stretches, regardless of source aspect ratio. */}
        <div className="flex w-full items-center justify-center border border-white/10 bg-ink-950">
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[80vh] w-auto max-w-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        </div>

        {/* Monospace micro-label: real pixel dimensions + raw source link. */}
        <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-mist-500">
          <span>{dims ? `${dims.w}×${dims.h}px` : "loading dimensions…"}</span>
          <a
            href={current.rawSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-full truncate underline decoration-ink-500 hover:text-mist-300"
          >
            {current.rawSrc}
          </a>
        </div>

        {total > 1 && (
          <div className="mt-3 flex w-full items-center justify-between">
            <button
              onClick={() => onIndexChange((index - 1 + total) % total)}
              className="flex items-center gap-1 border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-white hover:text-white"
            >
              <ChevronLeft size={13} aria-hidden="true" /> Prev
            </button>
            <span className="text-[11px] text-mist-500">Esc to close &middot; arrows to flip</span>
            <button
              onClick={() => onIndexChange((index + 1) % total)}
              className="flex items-center gap-1 border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-white hover:text-white"
            >
              Next <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

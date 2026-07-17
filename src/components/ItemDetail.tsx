"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import type { CatalogItem } from "@/data/catalog";
import { itemLink, itemStore, CATEGORY_WEIGHT_G } from "@/data/catalog";
import { Thumb } from "./Thumb";
import { AgentActions } from "./AgentActions";
import { StoreAvatar } from "./StoreAvatar";
import { CopyButton } from "./CopyButton";
import { catalogToSaved } from "./ItemCard";
import { useStore, duplicateNotice } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { MARKETPLACE_LABEL } from "@/lib/marketplaceLabel";

function QcModal({ item, start, onClose }: { item: CatalogItem; start: number; onClose: () => void }) {
  const [idx, setIdx] = useState(start);
  const total = Math.min(item.qcCount, 8);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % total);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + total) % total);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  // BUG FIX: this modal had no role/aria-modal, no scroll lock, and no
  // focus trap — unlike every other modal in the app.
  const containerRef = useModalA11y<HTMLDivElement>(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QC photo ${idx + 1} of ${total}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fade-up w-full max-w-lg overflow-hidden rounded-none border border-white/10 bg-ink-900 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mist-400">
            QC photo {idx + 1} / {total}
          </p>
          <button onClick={onClose} aria-label="Close viewer" className="rounded px-2 py-1 text-mist-400 hover:text-white">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div
          className="tile-shimmer flex aspect-square items-center justify-center"
          style={{ background: "#1a1a1a" }}
        >
          <span className="rounded-none bg-black/50 px-4 py-1.5 text-xs text-white/80">
            QC placeholder — real uploads land with the data pipeline
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIdx((idx - 1 + total) % total)}
            className="flex items-center gap-1 rounded-none border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-neon-500/60 hover:text-neon-300"
          >
            <ChevronLeft size={13} aria-hidden="true" /> Prev
          </button>
          <span className="text-[11px] text-mist-500">Esc to close · arrows to flip</span>
          <button
            onClick={() => setIdx((idx + 1) % total)}
            className="flex items-center gap-1 rounded-none border border-ink-500 px-3 py-1.5 text-xs text-mist-300 hover:border-neon-500/60 hover:text-neon-300"
          >
            Next <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ItemDetail({ id }: { id: string }) {
  const { inCart, addToCart, itemLocations, removeFromCart, wishlist, toggleWishlist, hydrated, fmtCny, toast, catalogItems, allStores } = useStore();
  const item = catalogItems.find((i) => i.id === id);
  const [qcOpen, setQcOpen] = useState<number | null>(null);

  if (!hydrated) return null;
  if (!item) {
    return (
      <div className="fade-up rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
        Item not found. <Link href="/browse" className="text-neon-300 underline">Back to Search</Link>
      </div>
    );
  }

  const link = itemLink(item);
  const store = itemStore(item);
  // Catalog items carry only a denormalized store name; pull the live directory
  // store's uploaded picture when it exists.
  const storeImage = allStores.find((s) => s.id === store.id)?.image ?? null;
  const carted = hydrated && inCart(`cat:${item.id}`);
  const wished = hydrated && wishlist.includes(item.id);
  const trusted = store.trust >= 85;

  return (
    <div className="fade-up">
      <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-mist-500 transition-colors hover:text-mist-100">
        <ArrowLeft size={14} aria-hidden="true" /> Back to search
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Thumb item={item} className="aspect-[4/3] rounded-none border border-white/5" />
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mist-100">
                Community QC photos ({item.qcCount})
              </h2>
              <span className="text-xs text-mist-500">Uploads open at launch</span>
            </div>
            {item.qcCount > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    onClick={() => setQcOpen(i)}
                    aria-label={`Open QC photo ${i + 1}`}
                    className="tile-shimmer aspect-square rounded-none border border-white/5 bg-ink-700 transition-transform hover:scale-[1.03]"
                    style={{ animationDelay: `${i * 300}ms` }}
                  />
                ))}
                <button
                  onClick={() => setQcOpen(3)}
                  className="flex aspect-square items-center justify-center rounded-none border border-white/5 bg-ink-800 text-sm text-mist-400 transition-colors hover:text-neon-300"
                >
                  +{Math.max(item.qcCount - 3, 0)}
                </button>
              </div>
            ) : (
              <p className="rounded-none border border-dashed border-ink-500 px-4 py-6 text-center text-sm text-mist-400">
                No QC photos yet — be the first to share yours after your haul arrives.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-mist-500">
            {MARKETPLACE_LABEL[item.marketplace]} · item {item.itemId}
          </p>
          <h1 className="mt-1 text-xl font-bold leading-snug text-mist-100">{item.title}</h1>
          <p className="flow-text mt-2 text-2xl font-extrabold">{fmtCny(item.priceCny)}</p>

          <Link
            href={`/store/${store.id}`}
            className="card-pop mt-4 flex items-center gap-3 rounded-none border border-white/5 bg-ink-800/80 px-4 py-3 text-sm"
          >
            <StoreAvatar store={{ name: store.name, image: storeImage }} className="h-9 w-9 rounded-none text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-mist-100">{store.name}</span>
              <span className="block text-xs text-mist-500">
                Score blends orders, disputes, account age, QC consistency.
              </span>
            </span>
            <span
              className={`rounded-none border px-2 py-0.5 text-xs font-medium ${
                trusted
                  ? "border-neon-400/25 bg-neon-500/10 text-neon-300"
                  : "border-warning/25 bg-warning/10 text-warning"
              }`}
            >
              Trust {store.trust}/100
            </span>
          </Link>

          {item.fitNote && (
            <div className="mt-3 rounded-none border border-aqua-400/20 bg-aqua-400/5 px-4 py-3 text-sm text-mist-300">
              <span className="font-semibold text-aqua-300">Fit:</span> {item.fitNote}
            </div>
          )}

          <p className="mt-3 text-xs text-mist-500">
            Est. shipping weight ~{CATEGORY_WEIGHT_G[item.category]} g
          </p>

          <div className="mt-5 space-y-2.5">
            <AgentActions link={link} />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (carted) removeFromCart(`cat:${item.id}`);
                  else {
                    const notice = duplicateNotice(itemLocations(`cat:${item.id}`));
                    addToCart(catalogToSaved(item));
                    toast(notice ?? "Added to cart", notice ? "info" : "success");
                  }
                }}
                aria-pressed={carted}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-none border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  carted
                    ? "border-neon-500/60 bg-neon-600/20 text-neon-300"
                    : "border-ink-500 text-mist-300 hover:border-neon-500/60 hover:bg-neon-600/10 hover:text-neon-300"
                }`}
              >
                {carted && <Check size={14} aria-hidden="true" />}
                {carted ? "In cart" : "Add to cart"}
              </button>
              <button
                onClick={() => toggleWishlist(item.id)}
                aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={wished}
                className={`rounded-none border px-4 transition-colors ${
                  wished
                    ? "border-danger/50 bg-danger/10 text-danger"
                    : "border-ink-500 text-mist-400 hover:text-danger"
                }`}
              >
                <Heart size={16} aria-hidden="true" className={wished ? "fill-current" : ""} />
              </button>
              <CopyButton text={link.rawUrl} label="Copy raw" className="px-4" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-none border border-white/5 bg-ink-700 px-2.5 py-1 text-xs text-mist-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {qcOpen !== null && <QcModal item={item} start={qcOpen} onClose={() => setQcOpen(null)} />}
    </div>
  );
}

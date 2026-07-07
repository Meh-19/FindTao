"use client";

import Link from "next/link";
import { Check, Heart, Plus } from "lucide-react";
import type { CatalogItem } from "@/data/catalog";
import { itemStore } from "@/data/catalog";
import { Thumb } from "./Thumb";
import { useStore } from "@/lib/store";

const MARKETPLACE_LABEL = { taobao: "Taobao", weidian: "Weidian", "1688": "1688", xianyu: "Xianyu" } as const;

export function ItemCard({ item, index = 0 }: { item: CatalogItem; index?: number }) {
  const { prefs, inCart, toggleCart, wishlist, toggleWishlist, hydrated, fmtCny, toast } = useStore();
  const store = itemStore(item);
  const carted = hydrated && inCart(item.id);
  const wished = hydrated && wishlist.includes(item.id);

  return (
    <div
      className="card-pop fade-up group relative overflow-hidden rounded-2xl border border-white/5 bg-ink-800/80"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <Link href={`/item/${item.id}`} className="block">
        <Thumb item={item} className="aspect-[4/3]" />
        <div className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-mist-500">
            {MARKETPLACE_LABEL[item.marketplace]} · {store.name}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-mist-100">
            {item.title}
          </h3>
          {prefs.autoPrices && <p className="mt-1.5 text-sm text-mist-300">{fmtCny(item.priceCny)}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {item.qcCount > 0 && (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-medium text-emerald-300">
                {item.qcCount} QC
              </span>
            )}
            {store.trust >= 85 ? (
              <span className="rounded-full border border-neon-400/25 bg-neon-500/10 px-2 py-0.5 font-medium text-neon-300">
                Trusted seller
              </span>
            ) : item.qcCount < 10 ? (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 font-medium text-amber-300">
                Low data
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <button
        onClick={() => toggleWishlist(item.id)}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={wished}
        className={`absolute left-3 top-3 rounded-full bg-black/45 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-black/70 ${
          wished ? "text-rose-400" : "text-white/70 hover:text-white"
        }`}
      >
        <Heart size={14} aria-hidden="true" className={wished ? "fill-current" : ""} />
      </button>
      <button
        onClick={() => {
          toggleCart(item.id);
          if (!carted) toast("Added to cart");
        }}
        aria-label={carted ? "Remove from cart" : "Add to cart"}
        aria-pressed={carted}
        className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg backdrop-blur-sm transition-all duration-200 ${
          carted ? "btn-glow text-white" : "bg-black/45 text-white/90 hover:bg-black/70 hover:text-white"
        }`}
      >
        {carted ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
        {carted ? "In cart" : "Cart"}
      </button>
    </div>
  );
}

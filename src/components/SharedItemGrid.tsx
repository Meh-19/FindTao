"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ImageOff, Plus, ShoppingBasket } from "lucide-react";
import { proxiedImg } from "@/lib/yupoo";
import { formatMoney } from "@/lib/currency";
import { formatShared, type SharedItem } from "@/lib/shareHaul";
import { useStore, type SavedItem } from "@/lib/store";

function toSaved(i: SharedItem): SavedItem {
  return {
    id: i.id || `shared:${i.title}:${i.image ?? ""}`,
    title: i.title,
    priceCny: i.priceCny,
    qty: i.qty,
    image: i.image,
    imgHost: i.imgHost,
    storeId: i.storeId,
    storeName: i.storeName,
    url: i.url,
  };
}

/**
 * Interactive grid on a shared haul/cart: each item links to its store and has
 * its own "add to cart" button, plus one "add all". Nothing is auto-imported —
 * the viewer chooses what to take. Works signed-out (cart is local).
 */
export function SharedItemGrid({
  items,
  currency,
  rate,
}: {
  items: SharedItem[];
  currency: string;
  rate: number;
}) {
  const { addToCart, importCart, setCartOpen, inCart, hydrated, toast } = useStore();
  const [addedAll, setAddedAll] = useState(false);

  function addOne(i: SharedItem) {
    const { qty, ...base } = toSaved(i);
    addToCart(base, qty);
    toast(`Added ${i.title.slice(0, 30)} to your cart`);
  }

  function addAll() {
    importCart(items.map(toSaved));
    setCartOpen(true);
    toast(`Added ${items.length} item${items.length === 1 ? "" : "s"} to your cart`);
    setAddedAll(true);
  }

  return (
    <>
      <button
        onClick={addAll}
        disabled={addedAll || items.length === 0}
        className="btn-glow mt-4 flex w-full items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {addedAll ? (
          <>
            <Check size={15} aria-hidden="true" /> All added to your cart
          </>
        ) : (
          <>
            <ShoppingBasket size={15} aria-hidden="true" /> Add all to cart
          </>
        )}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((i, idx) => {
          const carted = hydrated && inCart(toSaved(i).id);
          const href = i.storeId ? `/store/${i.storeId}` : null;
          const inner = (
            <>
              <div className="relative aspect-square overflow-hidden bg-ink-800">
                {i.image && i.imgHost ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxiedImg(i.image, i.imgHost)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-mist-500">
                    <ImageOff size={18} aria-hidden="true" />
                  </span>
                )}
                {i.qty > 1 && (
                  <span className="absolute bottom-1 right-1 rounded-none border border-white/10 bg-ink-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                    ×{i.qty}
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="line-clamp-1 text-xs font-medium text-mist-100" title={i.title}>
                  {i.title}
                </p>
                <p className="truncate text-[10px] text-mist-500">{i.storeName}</p>
                {i.priceCny !== null && (
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-mist-100">
                    {formatMoney(i.priceCny * i.qty, "CNY")}{" "}
                    <span className="flow-text font-bold">
                      {formatShared(i.priceCny * i.qty, currency, rate)}
                    </span>
                  </p>
                )}
              </div>
            </>
          );
          return (
            <div
              key={`${i.id}-${idx}`}
              className="card-pop group relative overflow-hidden rounded-none border border-white/5 bg-ink-800/80"
            >
              {href ? (
                <Link href={href} className="block">
                  {inner}
                </Link>
              ) : (
                <div className="block">{inner}</div>
              )}
              <button
                onClick={() => addOne(i)}
                aria-label={carted ? `${i.title} is in your cart` : `Add ${i.title} to cart`}
                className={`absolute right-1.5 top-1.5 flex items-center gap-1 rounded-none border px-2 py-1 text-[11px] font-semibold shadow-hard-sm transition-all ${
                  carted
                    ? "btn-glow text-white"
                    : "border-white/15 bg-ink-950/90 text-white/90 hover:bg-ink-950"
                }`}
              >
                {carted ? <Check size={11} aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

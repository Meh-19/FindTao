"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { itemStore } from "@/data/catalog";
import { ItemCard, catalogToSaved } from "@/components/ItemCard";
import { useStore, type CardSize } from "@/lib/store";
import { formatMoney } from "@/lib/currency";

const GRID: Record<CardSize, string> = {
  s: "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
  m: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  l: "grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
};

export default function WishlistPage() {
  const {
    prefs, wishlist, clearWishlist, catalogItems, hydrated,
    addToCart, inCart, toast, toastUndo, fmtConverted,
  } = useStore();

  // Newest heart first. Ids whose catalog item has since disappeared are counted, not rendered.
  const items = useMemo(() => {
    const byId = new Map(catalogItems.map((i) => [i.id, i]));
    return wishlist
      .map((id) => byId.get(id))
      .filter((i) => i !== undefined)
      .reverse();
  }, [wishlist, catalogItems]);

  if (!hydrated) return null;

  const missing = wishlist.length - items.length;
  const totalCny = items.reduce((sum, i) => sum + i.priceCny, 0);
  const uncarted = items.filter((i) => !inCart(`cat:${i.id}`));

  function addAll() {
    for (const item of uncarted) addToCart(catalogToSaved(item));
    toast(`${uncarted.length} item${uncarted.length === 1 ? "" : "s"} added to cart`);
  }

  return (
    <div className="fade-up py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <Heart size={26} aria-hidden="true" className="text-danger" />
          Your <span className="flow-text">wishlist</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Everything you&apos;ve hearted while browsing — the pile you buy from when the budget allows.
        </p>
      </div>

      {wishlist.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          Nothing hearted yet. Tap the{" "}
          <Heart size={12} aria-hidden="true" className="inline align-[-1px] text-danger" /> on any find in{" "}
          <Link href="/browse" className="text-neon-300 hover:text-neon-400">
            Search
          </Link>{" "}
          to park it here.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 border border-white/10 bg-ink-800/80 px-4 py-3">
            <p className="text-sm text-mist-300">
              <span className="font-semibold text-mist-100">{items.length}</span> item
              {items.length === 1 ? "" : "s"}
              {items.length > 0 && (
                <>
                  {" · "}
                  <span className="tabular-nums">{formatMoney(totalCny, "CNY")}</span>{" "}
                  <span className="text-mist-500">({fmtConverted(totalCny)}) if you bought it all</span>
                </>
              )}
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              {uncarted.length > 0 && (
                <button
                  onClick={addAll}
                  className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-xs font-semibold text-white"
                >
                  <ShoppingCart size={13} aria-hidden="true" />
                  Add {uncarted.length} to cart
                </button>
              )}
              <button
                onClick={() => toastUndo("Wishlist cleared", clearWishlist())}
                className="rounded-none border border-ink-500 px-4 py-2 text-xs font-medium text-mist-400 transition-colors hover:border-danger/40 hover:text-danger"
              >
                Clear
              </button>
            </div>
          </div>

          {missing > 0 && (
            <p className="mb-4 border border-warning/30 bg-warning/5 px-4 py-2.5 text-[11px] text-warning">
              {missing} hearted {missing === 1 ? "find is" : "finds are"} no longer in the catalog — clearing the
              wishlist drops {missing === 1 ? "it" : "them"}.
            </p>
          )}

          <div className={`grid ${GRID[prefs.cardSize]}`}>
            {items.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>

          {items.length > 0 && (
            <p className="mt-5 text-xs text-mist-500">
              Stores: {[...new Set(items.map((i) => itemStore(i).name))].join(" · ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

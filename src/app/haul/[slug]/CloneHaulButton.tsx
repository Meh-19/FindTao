"use client";

import { useState } from "react";
import { Check, ShoppingBasket } from "lucide-react";
import { useStore } from "@/lib/store";
import type { SharedItem } from "@/lib/shareHaul";

/**
 * "Clone this haul" — imports a shared haul's items into the viewer's own cart
 * (works signed-out; it's all local). The viral loop: browse someone's shared
 * haul, one click to start your own.
 */
export function CloneHaulButton({ items, name }: { items: SharedItem[]; name: string }) {
  const { importCart, setCartOpen, toast } = useStore();
  const [done, setDone] = useState(false);

  function clone() {
    importCart(
      items.map((i) => ({
        id: i.id || crypto.randomUUID(),
        title: i.title,
        priceCny: i.priceCny,
        qty: i.qty,
        image: i.image,
        imgHost: i.imgHost,
        storeId: i.storeId,
        storeName: i.storeName,
        url: i.url,
      })),
    );
    setCartOpen(true);
    toast(`Added ${items.length} item${items.length === 1 ? "" : "s"} from ${name} to your cart`);
    setDone(true);
  }

  return (
    <button
      onClick={clone}
      disabled={done || items.length === 0}
      className="btn-glow mt-4 flex w-full items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
    >
      {done ? (
        <>
          <Check size={15} aria-hidden="true" /> Added to your cart
        </>
      ) : (
        <>
          <ShoppingBasket size={15} aria-hidden="true" /> Clone this haul
        </>
      )}
    </button>
  );
}

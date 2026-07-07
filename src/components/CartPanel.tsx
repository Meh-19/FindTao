"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, X } from "lucide-react";
import { getItem } from "@/data/catalog";
import { Thumb } from "./Thumb";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";

export function CartPanel() {
  const {
    cart, cartOpen, setCartOpen, toggleCart, clearCart,
    hauls, prefs, setPrefs, assignCartToHaul, fmtConverted, toast, hydrated,
  } = useStore();
  const [targetHaul, setTargetHaul] = useState(prefs.activeHaulId);

  useEffect(() => setTargetHaul(prefs.activeHaulId), [prefs.activeHaulId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCartOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setCartOpen]);

  const items = useMemo(
    () => cart.map(getItem).filter((i): i is NonNullable<typeof i> => Boolean(i)),
    [cart],
  );
  const totalCny = items.reduce((sum, i) => sum + i.priceCny, 0);

  if (!hydrated) return null;

  function shareCart() {
    const url = `${window.location.origin}/browse?cart=${cart.join(",")}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Share link copied — opening it re-adds these items to the cart"),
      () => toast("Couldn't copy the link", "error"),
    );
  }

  function assign() {
    const haul = hauls.find((h) => h.id === targetHaul);
    assignCartToHaul(targetHaul);
    setPrefs({ activeHaulId: targetHaul });
    toast(`Moved ${items.length} item${items.length === 1 ? "" : "s"} to ${haul?.name ?? "haul"}`);
    setCartOpen(false);
  }

  return (
    <>
      <div
        onClick={() => setCartOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`cart-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-ink-900 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!cartOpen}
      >
        <div className="flow-bg h-0.5 shrink-0" />
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-mist-300">
            Cart <span className="text-mist-500">({items.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button
                onClick={() => { clearCart(); toast("Cart cleared", "info"); }}
                className="text-xs text-mist-500 transition-colors hover:text-red-400"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              aria-label="Close cart"
              className="rounded-lg px-2 py-1 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <p className="pt-10 text-center text-sm text-mist-500">
              Cart is empty — add finds while you browse, then assign them to a haul.
            </p>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-800/80 p-2.5">
                  <Thumb item={item} className="h-12 w-14 shrink-0 rounded-lg" label={false} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/item/${item.id}`}
                      onClick={() => setCartOpen(false)}
                      className="line-clamp-1 text-xs font-medium text-mist-100 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-[11px] text-mist-500">
                      {formatMoney(item.priceCny, "CNY")} ≈ {fmtConverted(item.priceCny)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleCart(item.id)}
                    aria-label="Remove from cart"
                    className="rounded px-1.5 py-1 text-mist-500 hover:text-red-400"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="shrink-0 border-t border-white/5 px-5 py-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mist-400">Subtotal</span>
              <span className="font-semibold text-mist-100">
                {formatMoney(totalCny, "CNY")}{" "}
                <span className="flow-text font-bold">≈ {fmtConverted(totalCny)}</span>
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <select
                value={targetHaul}
                onChange={(e) => setTargetHaul(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-ink-500 bg-ink-800 px-3 py-2 text-xs text-mist-100 outline-none focus:border-neon-500"
              >
                {hauls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <button onClick={assign} className="btn-glow rounded-xl px-4 py-2 text-xs font-semibold text-white">
                Assign to haul
              </button>
            </div>
            <button
              onClick={shareCart}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-500 px-4 py-2 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
            >
              <Link2 size={13} aria-hidden="true" />
              Share cart
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

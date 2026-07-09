"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageOff, Link2, Minus, Plus, X } from "lucide-react";
import { encodeCart } from "@/lib/share";
import { proxiedImg } from "@/lib/yupoo";
import { useStore, type SavedItem } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { formatMoney } from "@/lib/currency";

function LineThumb({ item }: { item: SavedItem }) {
  if (item.image && item.imgHost) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxiedImg(item.image, item.imgHost)}
        alt=""
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-none border border-white/5 object-cover"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none border border-white/5 bg-ink-700 text-mist-500">
      <ImageOff size={16} aria-hidden="true" />
    </span>
  );
}

export function CartPanel() {
  const {
    cart, cartCount, cartOpen, setCartOpen, setCartQty, removeFromCart, clearCart,
    hauls, prefs, setPrefs, assignCartToHaul, fmtConverted, toast, hydrated, allStores,
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

  const priced = useMemo(() => cart.filter((l) => l.priceCny !== null), [cart]);
  const totalCny = priced.reduce((sum, l) => sum + (l.priceCny ?? 0) * l.qty, 0);
  const unpricedCount = cart.length - priced.length;

  // BUG FIX: the cart drawer blocks interaction with the rest of the page
  // via its backdrop but never locked scroll or trapped focus like every
  // other modal-ish overlay in the app.
  const containerRef = useModalA11y<HTMLElement>(cartOpen);

  if (!hydrated) return null;

  function storeHref(line: SavedItem): string | null {
    return allStores.some((s) => s.id === line.storeId) ? `/store/${line.storeId}` : null;
  }

  function shareCart() {
    const url = `${window.location.origin}/browse?cart=${encodeCart(cart)}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Share link copied — opening it adds these items to the cart"),
      () => toast("Couldn't copy the link", "error"),
    );
  }

  function assign() {
    const haul = hauls.find((h) => h.id === targetHaul);
    assignCartToHaul(targetHaul);
    setPrefs({ activeHaulId: targetHaul });
    toast(`Moved ${cartCount} item${cartCount === 1 ? "" : "s"} to ${haul?.name ?? "haul"}`);
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
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className={`cart-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-ink-900 outline-none ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!cartOpen}
      >
        <div className="flow-bg h-0.5 shrink-0" />
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-mist-300">
            Cart <span className="text-mist-500">({cartCount})</span>
          </h2>
          <div className="flex items-center gap-3">
            {cart.length > 0 && (
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
              className="rounded-none px-2 py-1 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {cart.length === 0 ? (
            <p className="pt-10 text-center text-sm text-mist-500">
              Cart is empty — open an album while you browse and add pieces here, then assign
              them to a haul.
            </p>
          ) : (
            <div className="space-y-2.5">
              {cart.map((line) => {
                const href = storeHref(line);
                return (
                  <div key={line.id} className="flex gap-3 rounded-none border border-white/5 bg-ink-800/80 p-2.5">
                    <LineThumb item={line} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-mist-100" title={line.title}>
                        {line.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-mist-500">
                        {href ? (
                          <Link href={href} onClick={() => setCartOpen(false)} className="hover:text-neon-300 hover:underline">
                            {line.storeName}
                          </Link>
                        ) : (
                          line.storeName
                        )}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center rounded-none border border-ink-500">
                          <button
                            onClick={() => setCartQty(line.id, line.qty - 1)}
                            aria-label={`Decrease quantity of ${line.title}`}
                            className="px-2 py-1 text-mist-400 transition-colors hover:text-white"
                          >
                            <Minus size={11} aria-hidden="true" />
                          </button>
                          <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-mist-100">
                            {line.qty}
                          </span>
                          <button
                            onClick={() => setCartQty(line.id, line.qty + 1)}
                            aria-label={`Increase quantity of ${line.title}`}
                            className="px-2 py-1 text-mist-400 transition-colors hover:text-white"
                          >
                            <Plus size={11} aria-hidden="true" />
                          </button>
                        </div>
                        <p className="text-xs font-semibold tabular-nums text-mist-100">
                          {line.priceCny !== null ? (
                            formatMoney(line.priceCny * line.qty, "CNY")
                          ) : (
                            <span className="font-normal text-mist-500">price n/a</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(line.id)}
                      aria-label={`Remove ${line.title} from cart`}
                      className="self-start rounded px-1 py-1 text-mist-500 hover:text-red-400"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="shrink-0 border-t border-white/5 px-5 py-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mist-400">Subtotal</span>
              <span className="font-semibold text-mist-100">
                {formatMoney(totalCny, "CNY")}{" "}
                <span className="flow-text font-bold">≈ {fmtConverted(totalCny)}</span>
              </span>
            </div>
            {unpricedCount > 0 && (
              <p className="mt-1 text-right text-[11px] text-mist-500">
                + {unpricedCount} item{unpricedCount === 1 ? "" : "s"} without a listed price
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <select
                value={targetHaul}
                onChange={(e) => setTargetHaul(e.target.value)}
                className="min-w-0 flex-1 rounded-none border border-ink-500 bg-ink-800 px-3 py-2 text-xs text-mist-100 outline-none focus:border-neon-500"
              >
                {hauls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <button onClick={assign} className="btn-glow rounded-none px-4 py-2 text-xs font-semibold text-white">
                Assign to haul
              </button>
            </div>
            <button
              onClick={shareCart}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-none border border-ink-500 px-4 py-2 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
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

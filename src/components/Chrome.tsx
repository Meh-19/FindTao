"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Settings, ShoppingBasket, ShoppingCart } from "lucide-react";
import { useStore } from "@/lib/store";
import { getItem } from "@/data/catalog";

const VIEW_LABEL: Record<string, string> = {
  "": "Home",
  browse: "Search",
  wishlist: "Wishlist",
  drops: "New drops",
  library: "Library",
  discover: "Discover",
  w2c: "W2C finder",
  advisor: "AI Advisor",
  convert: "Converter",
  hauls: "Hauls",
  tracking: "Tracking",
  shipping: "Shipping",
  settings: "Settings",
  item: "Finds",
  store: "Stores",
  dev: "Dev panel",
};

function useCrumbs(): { label: string; href?: string }[] {
  const pathname = usePathname();
  const { catalogItems, allStores } = useStore();
  const [seg1, seg2] = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Home", href: "/" }];
  if (!seg1) return crumbs;
  crumbs.push({
    label: VIEW_LABEL[seg1] ?? seg1,
    href: seg2 ? (seg1 === "item" ? "/browse" : "/library") : undefined,
  });
  if (seg2) {
    const name =
      seg1 === "item"
        ? getItem(catalogItems, seg2)?.title
        : seg1 === "store"
          ? allStores.find((s) => s.id === seg2)?.name
          : seg2;
    crumbs.push({ label: name ?? seg2 });
  }
  return crumbs;
}

/** Sync state chip — amber "Local mode" when signed out, live sync status when signed in. */
export function SyncBadge() {
  const { cloudEnabled, user, syncStatus, hydrated } = useStore();

  if (!hydrated || !cloudEnabled || !user) {
    const signedOut = hydrated && cloudEnabled;
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-mist-500"
        title={
          signedOut
            ? "Sign in from Settings to sync across devices — everything is saved on this device."
            : "Cloud sync is not configured — everything is saved on this device."
        }
      >
        <span className={`h-1.5 w-1.5 rounded-none ${signedOut ? "bg-mist-500" : "bg-warning"}`} />
        {signedOut ? "Not signed in" : "Local mode"}
      </span>
    );
  }

  const state = {
    idle: { dot: "bg-success", label: "Cloud" },
    syncing: { dot: "bg-aqua-400 pulse-soft", label: "Syncing…" },
    synced: { dot: "bg-success", label: "Synced" },
    error: { dot: "bg-danger", label: "Sync error" },
  }[syncStatus];

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-mist-500" title={user.email ?? undefined}>
      <span className={`h-1.5 w-1.5 rounded-none ${state.dot}`} />
      {state.label}
    </span>
  );
}

export function Topbar() {
  const crumbs = useCrumbs();
  const { cartCount, setCartOpen, hydrated } = useStore();

  return (
    <div className="sticky top-0 z-30 hidden items-center justify-between border-b border-white/5 bg-ink-950/80 px-8 py-3 backdrop-blur md:flex">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-mist-500">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-mist-500/60">/</span>}
            {c.href ? (
              <Link href={c.href} className="transition-colors hover:text-mist-100">
                {c.label}
              </Link>
            ) : (
              <span className="truncate text-mist-300">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <SyncBadge />
        <button
          onClick={() => setCartOpen(true)}
          className="btn-glow flex items-center gap-2 rounded-none px-4 py-1.5 text-xs font-semibold text-white"
        >
          <ShoppingCart size={13} aria-hidden="true" />
          Cart
          {hydrated && cartCount > 0 && (
            <span className="rounded-none bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export function StatusBar() {
  const pathname = usePathname();
  const { prefs, rates, ratesLive, cartCount, activeHaul, hydrated } = useStore();
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  const rate = rates[prefs.currency];

  return (
    <div className="fixed bottom-0 left-60 right-0 z-30 hidden items-center justify-between border-t border-white/5 bg-ink-950/90 px-8 py-1.5 text-[11px] text-mist-500 backdrop-blur md:flex">
      <span>{VIEW_LABEL[seg] ?? seg}</span>
      <div className="flex items-center gap-5">
        {hydrated && (
          <>
            <span>
              Active haul: <span className="text-mist-300">{activeHaul.name}</span>
              {activeHaul.items.length > 0 && ` (${activeHaul.items.length})`}
            </span>
            <span>Cart: {cartCount}</span>
          </>
        )}
        <span title={ratesLive ? "Live rate via open.er-api.com" : "Fallback rate — live fetch unavailable"}>
          CNY→{prefs.currency}{" "}
          <span className="text-mist-300">{rate >= 10 ? rate.toFixed(1) : rate.toFixed(4)}</span>{" "}
          <span className={ratesLive ? "text-success" : "text-warning"}>
            {ratesLive ? "live" : "fallback"}
          </span>
        </span>
      </div>
    </div>
  );
}

const BOTTOM_LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/browse", label: "Search", Icon: Search },
  { href: "/hauls", label: "Hauls", Icon: ShoppingBasket },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const { cartCount, setCartOpen, hydrated } = useStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around border-t border-white/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {BOTTOM_LINKS.slice(0, 2).map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
            pathname === href ? "text-neon-300" : "text-mist-500"
          }`}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <button
        onClick={() => setCartOpen(true)}
        className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-mist-500"
      >
        <ShoppingCart size={18} aria-hidden="true" />
        Cart
        {hydrated && cartCount > 0 && (
          <span className="absolute right-1/4 top-1 rounded-none bg-neon-600 px-1.5 text-[9px] font-bold text-white">
            {cartCount}
          </span>
        )}
      </button>
      {BOTTOM_LINKS.slice(2).map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
            pathname === href ? "text-neon-300" : "text-mist-500"
          }`}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  const colors = {
    success: "border-success/40 text-success",
    error: "border-danger/40 text-danger",
    info: "border-aqua-400/40 text-aqua-300",
  };
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-72 flex-col gap-2 md:bottom-12"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in flex items-center gap-3 rounded-none border bg-ink-800/95 px-4 py-2.5 text-xs font-medium shadow-hard backdrop-blur ${colors[t.type]}`}
        >
          <span className="min-w-0 flex-1">{t.msg}</span>
          {t.action && (
            // The toast stack ignores pointer events so it never blocks the page — re-enable it just for the button.
            <button
              onClick={t.action.run}
              className="pointer-events-auto shrink-0 border border-current/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

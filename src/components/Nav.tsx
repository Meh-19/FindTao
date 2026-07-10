"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import {
  Globe,
  Home,
  LibraryBig,
  Link2,
  Menu,
  Package,
  Plane,
  Ruler,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Star,
  Wrench,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { SyncBadge } from "./Chrome";

const LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/browse", label: "Search", Icon: Search },
  { href: "/library", label: "Library", Icon: LibraryBig },
  { href: "/discover", label: "Discover", Icon: Globe },
  { href: "/advisor", label: "AI Advisor", Icon: Ruler },
  { href: "/convert", label: "Converter", Icon: Link2 },
  { href: "/hauls", label: "Hauls", Icon: ShoppingBasket },
  { href: "/tracking", label: "Tracking", Icon: Package },
  { href: "/shipping", label: "Shipping", Icon: Plane },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function AccountFooter() {
  const { cloudEnabled, user, profileName, hydrated } = useStore();
  const signedIn = hydrated && cloudEnabled && user;
  const display = signedIn ? (profileName ?? user.email ?? "Account") : "Guest";

  const inner = (
    <>
      {signedIn ? (
        <span className="flow-bg flex h-7 w-7 items-center justify-center rounded-none text-xs font-bold text-white">
          {display.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-none bg-ink-600 text-xs text-mist-300">
          G
        </span>
      )}
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-medium text-mist-300">{display}</span>
        <span className="block text-[10px] text-mist-500">
          {signedIn
            ? "Cloud sync on"
            : cloudEnabled
              ? "Sign in or create account"
              : "Local mode — data stays here"}
        </span>
      </span>
    </>
  );

  const cls = "flex w-full items-center gap-2.5 border-t border-white/5 px-5 py-3.5 transition-colors hover:bg-white/5";

  // Signed out → open Clerk's sign-in modal; signed in → manage the account in Settings.
  if (hydrated && cloudEnabled && !user) {
    return (
      <SignInButton mode="modal">
        <button className={cls}>{inner}</button>
      </SignInButton>
    );
  }
  return (
    <Link href="/settings" className={cls}>
      {inner}
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-5 pb-5 pt-6 text-xl font-bold tracking-tight">
      <span className="flow-bg inline-flex h-7 w-7 items-center justify-center rounded-none text-white shadow-hard-sm">
        <Sparkles size={14} aria-hidden="true" />
      </span>
      Find<span className="flow-text -ml-1">Tao</span>
    </Link>
  );
}

/** Nav links + hauls + store list — shared by the desktop sidebar and mobile drawer. */
function SidebarContent() {
  const pathname = usePathname();
  const { hauls, prefs, hydrated, allStores, library, favStores, isAdmin } = useStore();
  const libraryStores = hydrated ? allStores.filter((s) => library.includes(s.id)) : [];
  const links = isAdmin ? [...LINKS, { href: "/dev", label: "Dev", Icon: Wrench }] : LINKS;

  return (
    <>
      <nav className="flex flex-col gap-0.5 px-3">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-none px-3 py-2 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-neon-600/30 to-flare-500/10 text-white"
                  : "text-mist-400 hover:bg-white/5 hover:text-mist-100"
              }`}
            >
              {active && <span className="flow-bg absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-none" />}
              <Icon size={16} aria-hidden="true" className={active ? "text-neon-300" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {hydrated && hauls.length > 0 && (
        <div className="mt-4 px-3">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-mist-500">
            Hauls
          </p>
          {hauls.slice(0, 5).map((h) => (
            <Link
              key={h.id}
              href={`/hauls?focus=${h.id}`}
              className="group flex items-center gap-2.5 rounded-none px-3 py-1.5 text-xs text-mist-400 transition-colors hover:bg-white/5 hover:text-mist-100"
            >
              <span
                className={`h-1.5 w-1.5 rounded-none ${
                  h.id === prefs.activeHaulId ? "flow-bg pulse-soft" : "bg-ink-500"
                }`}
              />
              <span className="truncate">{h.name}</span>
              {h.items.length > 0 && <span className="ml-auto text-mist-500">{h.items.length}</span>}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <div className="flex items-center justify-between px-3 pb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-mist-500">
            My stores
          </p>
          <Link href="/discover" className="text-[10px] text-neon-300 hover:text-neon-400">
            + Add
          </Link>
        </div>
        {libraryStores.length === 0 ? (
          <p className="px-3 text-xs text-mist-500">No stores saved yet.</p>
        ) : (
          libraryStores.map((s) => (
            <Link
              key={s.id}
              href={`/store/${s.id}`}
              className={`group flex items-center gap-2.5 rounded-none px-3 py-1.5 transition-colors hover:bg-white/5 ${
                pathname === `/store/${s.id}` ? "bg-white/5" : ""
              }`}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-[9px] font-bold text-white shadow"
                style={{ background: "#1a1a1a" }}
              >
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xs text-mist-300 group-hover:text-mist-100">
                  <span className="truncate">{s.name}</span>
                  {favStores.includes(s.id) && (
                    <Star size={10} aria-label="Favorite" className="shrink-0 fill-amber-300 text-amber-300" />
                  )}
                </span>
                <span className="block truncate text-[10px] text-mist-500">
                  {s.categories.join(" · ")}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>

      <AccountFooter />
    </>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on navigation and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // BUG FIX: the mobile drawer had no scroll lock or focus trap, unlike
  // every other overlay in the app.
  const drawerRef = useModalA11y<HTMLElement>(drawerOpen);

  return (
    <>
      {/* Mobile top bar — hamburger opens the full drawer */}
      <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-none p-1.5 text-mist-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Link href="/" className="text-lg font-bold tracking-tight">
            Find<span className="flow-text">Tao</span>
          </Link>
        </div>
        <SyncBadge />
      </header>

      {/* Mobile drawer */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`cart-panel fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-ink-900 outline-none md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between pr-3">
          <Logo />
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="rounded-none p-1.5 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/70 backdrop-blur md:flex">
        <Logo />
        <SidebarContent />
      </aside>
    </>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Currency, RateTable } from "./currency";
import { FALLBACK_RATES, convertCny, formatCnyWith, formatMoney } from "./currency";
import { DEFAULT_AGENT_ID } from "./agents";
import { supabase } from "./supabase";
import { STORES, DEFAULT_LIBRARY_IDS } from "@/data/stores";
import type { StoreInfo } from "@/data/stores";

export type CardSize = "s" | "m" | "l";
export type AccentId = "violet" | "blue" | "emerald" | "rose" | "amber";

export const ACCENTS: Record<AccentId, [string, string, string]> = {
  violet: ["#8b5cf6", "#d946ef", "#22d3ee"],
  blue: ["#3b82f6", "#8b5cf6", "#22d3ee"],
  emerald: ["#10b981", "#22d3ee", "#a3e635"],
  rose: ["#f43f5e", "#d946ef", "#f59e0b"],
  amber: ["#f59e0b", "#ef4444", "#eab308"],
};

export interface Prefs {
  agentId: string;
  currency: Currency;
  /** Skip the agent dropdown and always hand off to the preferred agent. */
  oneClick: boolean;
  cardSize: CardSize;
  accent: AccentId;
  autoPrices: boolean;
  activeHaulId: string;
}

export interface Haul {
  id: string;
  name: string;
  budgetCny: number | null;
  items: string[];
}

export interface TrackedPkg {
  number: string;
  carrier: string;
  addedAt: number;
}

interface Toast {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface CloudUser {
  id: string;
  email: string | null;
}

/** Everything that persists — mirrored to localStorage and, when signed in, to Supabase. */
interface CloudSnapshot {
  prefs: Prefs;
  wishlist: string[];
  cart: string[];
  hauls: Haul[];
  library: string[];
  favStores: string[];
  userStores: StoreInfo[];
  tracking: TrackedPkg[];
}

const DEFAULT_PREFS: Prefs = {
  agentId: DEFAULT_AGENT_ID,
  currency: "USD",
  oneClick: false,
  cardSize: "m",
  accent: "violet",
  autoPrices: true,
  activeHaulId: "main",
};

const DEFAULT_HAULS: Haul[] = [{ id: "main", name: "Main haul", budgetCny: null, items: [] }];

const K = {
  prefs: "findtao:prefs",
  wishlist: "findtao:wishlist",
  cart: "findtao:cart",
  hauls: "findtao:hauls",
  legacyHaul: "findtao:haul",
  library: "findtao:library",
  favStores: "findtao:favstores",
  userStores: "findtao:userstores",
  tracking: "findtao:tracking",
  fx: "findtao:fx",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface Store {
  hydrated: boolean;
  prefs: Prefs;
  setPrefs: (update: Partial<Prefs>) => void;
  rates: RateTable;
  ratesLive: boolean;
  fmtCny: (amountCny: number) => string;
  fmtConverted: (amountCny: number) => string;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  cart: string[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  inCart: (id: string) => boolean;
  toggleCart: (id: string) => void;
  clearCart: () => void;
  hauls: Haul[];
  activeHaul: Haul;
  createHaul: (name: string) => void;
  renameHaul: (id: string, name: string) => void;
  deleteHaul: (id: string) => void;
  setHaulBudget: (id: string, budgetCny: number | null) => void;
  removeFromHaul: (haulId: string, itemId: string) => void;
  assignCartToHaul: (haulId: string) => void;
  allStores: StoreInfo[];
  library: string[];
  favStores: string[];
  inLibrary: (id: string) => boolean;
  addToLibrary: (id: string) => void;
  removeFromLibrary: (id: string) => void;
  toggleFavStore: (id: string) => void;
  submitStore: (store: StoreInfo) => void;
  tracking: TrackedPkg[];
  addTracking: (pkg: TrackedPkg) => void;
  removeTracking: (number: string) => void;
  toasts: Toast[];
  toast: (msg: string, type?: Toast["type"]) => void;
  /** False when Supabase env vars aren't configured — sign-in is unavailable. */
  cloudEnabled: boolean;
  user: CloudUser | null;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  signInWithEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [rates, setRates] = useState<RateTable>(FALLBACK_RATES);
  const [ratesLive, setRatesLive] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hauls, setHauls] = useState<Haul[]>(DEFAULT_HAULS);
  const [library, setLibrary] = useState<string[]>(DEFAULT_LIBRARY_IDS);
  const [favStores, setFavStores] = useState<string[]>([]);
  const [userStores, setUserStores] = useState<StoreInfo[]>([]);
  const [tracking, setTracking] = useState<TrackedPkg[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  // Blocks pushes until the initial pull after sign-in finishes, so local
  // defaults never clobber the cloud copy.
  const pulledRef = useRef(false);

  useEffect(() => {
    setPrefsState({ ...DEFAULT_PREFS, ...read(K.prefs, {}) });
    setWishlist(read(K.wishlist, []));
    setCart(read(K.cart, []));
    const storedHauls = read<Haul[]>(K.hauls, []);
    if (storedHauls.length > 0) {
      setHauls(storedHauls);
    } else {
      // Migrate the v1 single-haul list into the main haul.
      const legacy = read<string[]>(K.legacyHaul, []);
      if (legacy.length > 0) setHauls([{ ...DEFAULT_HAULS[0], items: legacy }]);
    }
    setLibrary(read(K.library, DEFAULT_LIBRARY_IDS));
    setFavStores(read(K.favStores, []));
    setUserStores(read(K.userStores, []));
    setTracking(read(K.tracking, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(K.prefs, JSON.stringify(prefs));
    window.localStorage.setItem(K.wishlist, JSON.stringify(wishlist));
    window.localStorage.setItem(K.cart, JSON.stringify(cart));
    window.localStorage.setItem(K.hauls, JSON.stringify(hauls));
    window.localStorage.setItem(K.library, JSON.stringify(library));
    window.localStorage.setItem(K.favStores, JSON.stringify(favStores));
    window.localStorage.setItem(K.userStores, JSON.stringify(userStores));
    window.localStorage.setItem(K.tracking, JSON.stringify(tracking));
  }, [hydrated, prefs, wishlist, cart, hauls, library, favStores, userStores, tracking]);

  // Live CNY rates, cached for 12h; FALLBACK_RATES until the fetch lands or on failure.
  useEffect(() => {
    const cached = read<{ ts: number; rates: RateTable } | null>(K.fx, null);
    if (cached && Date.now() - cached.ts < 12 * 3600_000) {
      setRates({ ...FALLBACK_RATES, ...cached.rates });
      setRatesLive(true);
      return;
    }
    fetch("https://open.er-api.com/v6/latest/CNY")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.rates) return;
        const next = { ...FALLBACK_RATES };
        for (const c of Object.keys(next) as Currency[]) {
          if (typeof data.rates[c] === "number") next[c] = data.rates[c];
        }
        setRates(next);
        setRatesLive(true);
        window.localStorage.setItem(K.fx, JSON.stringify({ ts: Date.now(), rates: next }));
      })
      .catch(() => {});
  }, []);

  // Accent theme → CSS variables consumed by .flow-bg / .flow-text / .btn-glow.
  useEffect(() => {
    const [a, b, c] = ACCENTS[prefs.accent] ?? ACCENTS.violet;
    const root = document.documentElement;
    root.style.setProperty("--acc1", a);
    root.style.setProperty("--acc2", b);
    root.style.setProperty("--acc3", c);
  }, [prefs.accent]);

  const setPrefs = useCallback((update: Partial<Prefs>) => {
    setPrefsState((prev) => ({ ...prev, ...update }));
  }, []);

  const toast = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleCart = useCallback((id: string) => {
    setCart((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const createHaul = useCallback((name: string) => {
    const id = `haul-${Date.now().toString(36)}`;
    setHauls((prev) => [...prev, { id, name, budgetCny: null, items: [] }]);
    setPrefsState((prev) => ({ ...prev, activeHaulId: id }));
  }, []);

  const renameHaul = useCallback((id: string, name: string) => {
    setHauls((prev) => prev.map((h) => (h.id === id ? { ...h, name } : h)));
  }, []);

  const deleteHaul = useCallback((id: string) => {
    setHauls((prev) => {
      const next = prev.filter((h) => h.id !== id);
      return next.length > 0 ? next : DEFAULT_HAULS;
    });
    setPrefsState((prev) =>
      prev.activeHaulId === id ? { ...prev, activeHaulId: "main" } : prev,
    );
  }, []);

  const setHaulBudget = useCallback((id: string, budgetCny: number | null) => {
    setHauls((prev) => prev.map((h) => (h.id === id ? { ...h, budgetCny } : h)));
  }, []);

  const removeFromHaul = useCallback((haulId: string, itemId: string) => {
    setHauls((prev) =>
      prev.map((h) => (h.id === haulId ? { ...h, items: h.items.filter((i) => i !== itemId) } : h)),
    );
  }, []);

  const assignCartToHaul = useCallback((haulId: string) => {
    setCart((currentCart) => {
      setHauls((prev) =>
        prev.map((h) =>
          h.id === haulId ? { ...h, items: [...new Set([...h.items, ...currentCart])] } : h,
        ),
      );
      return [];
    });
  }, []);

  const addToLibrary = useCallback((id: string) => {
    setLibrary((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((x) => x !== id));
    setFavStores((prev) => prev.filter((x) => x !== id));
  }, []);

  const toggleFavStore = useCallback((id: string) => {
    setFavStores((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const submitStore = useCallback((store: StoreInfo) => {
    setUserStores((prev) => [...prev, store]);
    setLibrary((prev) => [...prev, store.id]);
  }, []);

  const addTracking = useCallback((pkg: TrackedPkg) => {
    setTracking((prev) => [pkg, ...prev.filter((p) => p.number !== pkg.number)]);
  }, []);

  const removeTracking = useCallback((number: string) => {
    setTracking((prev) => prev.filter((p) => p.number !== number));
  }, []);

  const snapshot = useMemo<CloudSnapshot>(
    () => ({ prefs, wishlist, cart, hauls, library, favStores, userStores, tracking }),
    [prefs, wishlist, cart, hauls, library, favStores, userStores, tracking],
  );

  const applySnapshot = useCallback((s: Partial<CloudSnapshot>) => {
    if (s.prefs) setPrefsState({ ...DEFAULT_PREFS, ...s.prefs });
    if (Array.isArray(s.wishlist)) setWishlist(s.wishlist);
    if (Array.isArray(s.cart)) setCart(s.cart);
    if (Array.isArray(s.hauls) && s.hauls.length > 0) setHauls(s.hauls);
    if (Array.isArray(s.library)) setLibrary(s.library);
    if (Array.isArray(s.favStores)) setFavStores(s.favStores);
    if (Array.isArray(s.userStores)) setUserStores(s.userStores);
    if (Array.isArray(s.tracking)) setTracking(s.tracking);
  }, []);

  // Watch Supabase auth state. No-op in local-only mode.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pull the cloud copy once per sign-in. A missing row means a first-time
  // user — their local state gets pushed by the effect below.
  useEffect(() => {
    if (!supabase || !user || !hydrated) return;
    const sb = supabase;
    let cancelled = false;
    (async () => {
      setSyncStatus("syncing");
      const { data, error } = await sb
        .from("user_state")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setSyncStatus("error");
        toast("Couldn't reach cloud sync — working locally", "error");
        return;
      }
      if (data?.data && Object.keys(data.data).length > 0) {
        applySnapshot(data.data as Partial<CloudSnapshot>);
        toast("Synced from cloud");
      }
      pulledRef.current = true;
      setSyncStatus("synced");
      setLastSyncAt(Date.now());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hydrated]);

  // Debounced push of every persisted change while signed in.
  useEffect(() => {
    if (!supabase || !user || !hydrated || !pulledRef.current) return;
    const sb = supabase;
    setSyncStatus("syncing");
    const timer = setTimeout(async () => {
      const { error } = await sb
        .from("user_state")
        .upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() });
      if (error) {
        setSyncStatus("error");
      } else {
        setSyncStatus("synced");
        setLastSyncAt(Date.now());
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [snapshot, user, hydrated]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) return false;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast(error.message, "error");
        return false;
      }
      toast("Check your email for the sign-in link", "info");
      return true;
    },
    [toast],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    pulledRef.current = false;
    setSyncStatus("idle");
    setLastSyncAt(null);
    toast("Signed out — your data stays on this device", "info");
  }, [toast]);

  const syncNow = useCallback(async () => {
    if (!supabase || !user) return;
    setSyncStatus("syncing");
    const { error } = await supabase
      .from("user_state")
      .upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() });
    if (error) {
      setSyncStatus("error");
      toast("Sync failed — try again in a moment", "error");
    } else {
      pulledRef.current = true;
      setSyncStatus("synced");
      setLastSyncAt(Date.now());
      toast("Everything synced to cloud");
    }
  }, [user, snapshot, toast]);

  const allStores = useMemo(() => [...STORES, ...userStores], [userStores]);

  const activeHaul = useMemo(
    () => hauls.find((h) => h.id === prefs.activeHaulId) ?? hauls[0],
    [hauls, prefs.activeHaulId],
  );

  const fmtCny = useCallback(
    (amountCny: number) => formatCnyWith(amountCny, prefs.currency, rates),
    [prefs.currency, rates],
  );

  const fmtConverted = useCallback(
    (amountCny: number) =>
      prefs.currency === "CNY"
        ? formatMoney(amountCny, "CNY")
        : formatMoney(convertCny(amountCny, prefs.currency, rates), prefs.currency),
    [prefs.currency, rates],
  );

  const value = useMemo<Store>(
    () => ({
      hydrated,
      prefs,
      setPrefs,
      rates,
      ratesLive,
      fmtCny,
      fmtConverted,
      wishlist,
      toggleWishlist,
      cart,
      cartOpen,
      setCartOpen,
      inCart: (id) => cart.includes(id),
      toggleCart,
      clearCart,
      hauls,
      activeHaul,
      createHaul,
      renameHaul,
      deleteHaul,
      setHaulBudget,
      removeFromHaul,
      assignCartToHaul,
      allStores,
      library,
      favStores,
      inLibrary: (id) => library.includes(id),
      addToLibrary,
      removeFromLibrary,
      toggleFavStore,
      submitStore,
      tracking,
      addTracking,
      removeTracking,
      toasts,
      toast,
      cloudEnabled: supabase !== null,
      user,
      syncStatus,
      lastSyncAt,
      signInWithEmail,
      signOut,
      syncNow,
    }),
    [
      hydrated, prefs, setPrefs, rates, ratesLive, fmtCny, fmtConverted,
      wishlist, toggleWishlist, cart, cartOpen, toggleCart, clearCart,
      hauls, activeHaul, createHaul, renameHaul, deleteHaul, setHaulBudget,
      removeFromHaul, assignCartToHaul, allStores, library, favStores,
      addToLibrary, removeFromLibrary, toggleFavStore, submitStore,
      tracking, addTracking, removeTracking, toasts, toast,
      user, syncStatus, lastSyncAt, signInWithEmail, signOut, syncNow,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

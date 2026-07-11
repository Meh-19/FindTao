"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Currency, RateTable } from "./currency";
import { FALLBACK_RATES, convertCny, formatCnyWith, formatMoney } from "./currency";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useUser, useSession, useClerk } from "@clerk/nextjs";
import { DEFAULT_AGENT_ID } from "./agents";
import { withRef } from "./links";
import { createClerkSupabaseClient, resolveSupabaseConfig, type SupabaseConfig } from "./supabase";
import { makeShareSlug } from "./shareHaul";
import { STORES, DEFAULT_LIBRARY_IDS } from "@/data/stores";
import type { StoreCategory, StoreInfo } from "@/data/stores";
import type { CatalogItem, Category } from "@/data/catalog";
import { EMPTY_MEASUREMENTS, type Measurements } from "./measurements";

export interface TagDef {
  id: number;
  kind: "store" | "user";
  name: string;
  color: string;
}

interface DirectoryRow {
  id: string;
  name: string;
  url: string;
  categories: string[];
  tags: string[];
  blurb: string;
  hue1: string;
  hue2: string;
  trust: number;
  discover: boolean;
  banned: boolean;
}

function rowToStore(row: DirectoryRow): StoreInfo {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    categories: row.categories as StoreCategory[],
    hue: [row.hue1, row.hue2],
    trust: row.trust,
    blurb: row.blurb,
    albums: 0,
    community: true,
    tags: row.tags,
    discover: row.discover,
    banned: row.banned,
  };
}

interface CatalogItemRow {
  id: string;
  title: string;
  marketplace: string;
  item_id: string;
  price_cny: number;
  category: string;
  store_id: string;
  store_name: string;
  store_trust: number;
  qc_count: number;
  tags: string[];
  fit_note: string | null;
  hue1: string;
  hue2: string;
}

function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    title: row.title,
    marketplace: row.marketplace as CatalogItem["marketplace"],
    itemId: row.item_id,
    priceCny: row.price_cny,
    category: row.category as Category,
    storeId: row.store_id,
    storeName: row.store_name,
    storeTrust: row.store_trust,
    qcCount: row.qc_count,
    tags: row.tags,
    hue: [row.hue1, row.hue2],
    fitNote: row.fit_note ?? undefined,
  };
}

export type CardSize = "s" | "m" | "l";
export type AccentId = "mono" | "signal" | "acid" | "cobalt" | "amber";

/**
 * Accent themes — each is a single flat color (no gradients, keeps the
 * "Streetwear Index" brutalist base) applied to CTA buttons, highlighted
 * text, and hard-shadow tints via the --acc1/--acc-ink CSS variables.
 * `ink` is the readable text color to put on top of `fg`.
 */
export const ACCENTS: Record<AccentId, { label: string; fg: string; ink: string }> = {
  mono: { label: "Mono", fg: "#ffffff", ink: "#000000" },
  signal: { label: "Signal Red", fg: "#ef4444", ink: "#ffffff" },
  acid: { label: "Acid Green", fg: "#a3e635", ink: "#000000" },
  cobalt: { label: "Cobalt Blue", fg: "#3b82f6", ink: "#ffffff" },
  amber: { label: "Amber", fg: "#f59e0b", ink: "#000000" },
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
  /** Personal referral query fragments per agent id — override the site defaults. */
  myRefs: Record<string, string>;
  /** Reused slug for this user's shared cart, so re-sharing updates one link. */
  cartShareSlug?: string;
}

/**
 * A self-contained product line — everything the cart and hauls need without
 * a catalog lookup. Created from live Yupoo albums (and any future source).
 */
export interface SavedItem {
  id: string;
  title: string;
  priceCny: number | null;
  qty: number;
  /** Raw photo.yupoo.com URL + owning store host — proxied at render time. */
  image: string | null;
  imgHost: string | null;
  storeId: string;
  storeName: string;
  /** Marketplace item URL when known — powers the buy-on-agent links. */
  url: string | null;
}

export interface Haul {
  id: string;
  name: string;
  budgetCny: number | null;
  items: SavedItem[];
  /** Slug of the published share (shared_hauls.slug) once this haul is shared. */
  shareSlug?: string;
  /** Whether the published share is publicly viewable. Mirrors shared_hauls.public. */
  sharePublic?: boolean;
}

/** Per-unit parcel weight estimate (grams) — SavedItem carries no category, so hauls use a flat figure. */
export const HAUL_UNIT_WEIGHT_G = 600;

/** Item count, priced total (CNY), and estimated weight for a haul — shared by the card, share page, and OG image. */
export function haulStats(items: SavedItem[]): { unitCount: number; totalCny: number; weightG: number } {
  const unitCount = items.reduce((sum, i) => sum + i.qty, 0);
  const totalCny = items.reduce((sum, i) => sum + (i.priceCny ?? 0) * i.qty, 0);
  return { unitCount, totalCny, weightG: unitCount * HAUL_UNIT_WEIGHT_G };
}

/** Distinct stores present in a set of items — powers the share store-filter picker. */
export function shareableStores(items: SavedItem[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const i of items) if (i.storeId && !seen.has(i.storeId)) seen.set(i.storeId, i.storeName);
  return [...seen].map(([id, name]) => ({ id, name }));
}

function sanitizeItems(value: unknown): SavedItem[] {
  if (!Array.isArray(value)) return [];
  const out: SavedItem[] = [];
  for (const raw of value) {
    // Drops v1 entries (plain catalog-id strings) along with anything malformed.
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Partial<SavedItem>;
    if (typeof r.id !== "string" || typeof r.title !== "string") continue;
    out.push({
      id: r.id,
      title: r.title,
      priceCny: typeof r.priceCny === "number" ? r.priceCny : null,
      qty: typeof r.qty === "number" && r.qty >= 1 ? Math.floor(r.qty) : 1,
      image: typeof r.image === "string" ? r.image : null,
      imgHost: typeof r.imgHost === "string" ? r.imgHost : null,
      storeId: typeof r.storeId === "string" ? r.storeId : "",
      storeName: typeof r.storeName === "string" ? r.storeName : "",
      url: typeof r.url === "string" ? r.url : null,
    });
  }
  return out;
}

function sanitizeHauls(value: unknown): Haul[] {
  if (!Array.isArray(value)) return [];
  const out: Haul[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Partial<Haul> & { items?: unknown };
    if (typeof r.id !== "string" || typeof r.name !== "string") continue;
    out.push({
      id: r.id,
      name: r.name,
      budgetCny: typeof r.budgetCny === "number" ? r.budgetCny : null,
      items: sanitizeItems(r.items),
      ...(typeof r.shareSlug === "string" ? { shareSlug: r.shareSlug } : {}),
      ...(typeof r.sharePublic === "boolean" ? { sharePublic: r.sharePublic } : {}),
    });
  }
  return out;
}

function sanitizeMeasurements(value: unknown): Measurements {
  if (typeof value !== "object" || value === null) return EMPTY_MEASUREMENTS;
  const r = value as Partial<Measurements>;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    unit: r.unit === "cm" ? "cm" : "in",
    heightCm: num(r.heightCm),
    weightKg: num(r.weightKg),
    chestCm: num(r.chestCm),
    shoulderWidthCm: num(r.shoulderWidthCm),
    sleeveLengthCm: num(r.sleeveLengthCm),
    bodyLengthCm: num(r.bodyLengthCm),
    neckCm: num(r.neckCm),
    waistCm: num(r.waistCm),
    hipsCm: num(r.hipsCm),
    inseamCm: num(r.inseamCm),
    thighCm: num(r.thighCm),
    riseCm: num(r.riseCm),
    shoeSizeUs: num(r.shoeSizeUs),
    shoeSizeEu: num(r.shoeSizeEu),
    shoeSizeUk: num(r.shoeSizeUk),
    footLengthCm: num(r.footLengthCm),
    fitPreference:
      r.fitPreference === "slim" || r.fitPreference === "relaxed" || r.fitPreference === "oversized"
        ? r.fitPreference
        : "regular",
  };
}

function sanitizePriceOverrides(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

function sanitizeStoreSeen(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(value)) {
    if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
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
  /** Username captured in auth metadata at sign-up/sign-in time, if any — used to backfill the profiles row. */
  metaUsername: string | null;
  /** Clerk avatar URL — shown as the owner chip on shared hauls/carts. */
  image: string | null;
}

/** Everything that persists — mirrored to localStorage and, when signed in, to Supabase. */
interface CloudSnapshot {
  prefs: Prefs;
  wishlist: string[];
  cart: SavedItem[];
  hauls: Haul[];
  library: string[];
  favStores: string[];
  userStores: StoreInfo[];
  tracking: TrackedPkg[];
  measurements: Measurements;
  /** Manual CNY price per album cart id (`album:{host}:{yupooId}`) when the listing didn't parse one. */
  priceOverrides: Record<string, number>;
  /** Yupoo album ids the user has already seen per store id — powers "new release" badges. */
  storeSeen: Record<string, string[]>;
}

const DEFAULT_PREFS: Prefs = {
  agentId: DEFAULT_AGENT_ID,
  currency: "USD",
  oneClick: false,
  cardSize: "m",
  accent: "mono",
  autoPrices: true,
  activeHaulId: "main",
  myRefs: {},
};

const DEFAULT_HAULS: Haul[] = [{ id: "main", name: "Main haul", budgetCny: null, items: [] }];

const K = {
  prefs: "findtao:prefs",
  wishlist: "findtao:wishlist",
  cart: "findtao:cart",
  hauls: "findtao:hauls",
  library: "findtao:library",
  favStores: "findtao:favstores",
  userStores: "findtao:userstores",
  tracking: "findtao:tracking",
  measurements: "findtao:measurements",
  priceOverrides: "findtao:priceoverrides",
  storeSeen: "findtao:storeseen",
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
  cart: SavedItem[];
  /** Total units across all cart lines — the badge number. */
  cartCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  inCart: (id: string) => boolean;
  addToCart: (item: Omit<SavedItem, "qty">, qty?: number) => void;
  setCartQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  hauls: Haul[];
  activeHaul: Haul;
  createHaul: (name: string) => void;
  renameHaul: (id: string, name: string) => void;
  deleteHaul: (id: string) => void;
  setHaulBudget: (id: string, budgetCny: number | null) => void;
  removeFromHaul: (haulId: string, itemId: string) => void;
  importCart: (items: SavedItem[]) => void;
  assignCartToHaul: (haulId: string) => void;
  /** Publish a haul snapshot to shared_hauls (sign-in required); optional store filter; returns the share URL. */
  shareHaul: (haulId: string, opts?: { storeIds?: string[] }) => Promise<string | null>;
  /** Publish the current cart as a shared snapshot (sign-in required); optional store filter; returns the share URL. */
  shareCart: (opts?: { storeIds?: string[] }) => Promise<string | null>;
  /** Delete the published share and clear the haul's share slug. */
  unshareHaul: (haulId: string) => Promise<void>;
  /** Toggle a shared haul's public visibility. */
  setHaulPublic: (haulId: string, next: boolean) => Promise<void>;
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
  /** Body measurements + fit preference for the AI Advisor — persisted like everything else. */
  measurements: Measurements;
  setMeasurements: (update: Partial<Measurements>) => void;
  /** Manual CNY price per album cart id, for listings that didn't parse a price. */
  priceOverrides: Record<string, number>;
  setPriceOverride: (id: string, price: number | null) => void;
  /** Yupoo album ids the user has seen per store id (drives "new release" flags). */
  storeSeen: Record<string, string[]>;
  markStoreSeen: (storeId: string, ids: string[]) => void;
  toasts: Toast[];
  toast: (msg: string, type?: Toast["type"]) => void;
  /** False when Supabase config is unavailable — sign-in is disabled. */
  cloudEnabled: boolean;
  /** The resolved Supabase client, for feature code (dev panel) that needs direct queries. */
  sb: SupabaseClient | null;
  user: CloudUser | null;
  /** Display name from the profile (set at sign-up); null before it loads. */
  profileName: string | null;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  /** Opens the Clerk sign-in modal (kept as a stable name so nav/settings triggers are unchanged). */
  setAuthOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  /** Site-default referral fragments per agent id, set from the dev panel. */
  agentRefs: Record<string, string>;
  refreshAgentRefs: () => Promise<void>;
  /** Append the effective referral code (user's own, else site default) to an agent URL. */
  applyRef: (url: string | null, agentId: string) => string | null;
  /** Community directory from Supabase (admins also see banned rows). */
  directory: StoreInfo[];
  refreshDirectory: () => Promise<void>;
  /** Admin-curated product catalog from Supabase — powers Browse, item cards/detail. */
  catalogItems: CatalogItem[];
  refreshCatalogItems: () => Promise<void>;
  tagDefs: TagDef[];
  refreshTagDefs: () => Promise<void>;
  /** Role-style tags on the signed-in user's profile. */
  profileTags: string[];
  isAdmin: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [rates, setRates] = useState<RateTable>(FALLBACK_RATES);
  const [ratesLive, setRatesLive] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<SavedItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hauls, setHauls] = useState<Haul[]>(DEFAULT_HAULS);
  const [library, setLibrary] = useState<string[]>(DEFAULT_LIBRARY_IDS);
  const [favStores, setFavStores] = useState<string[]>([]);
  const [userStores, setUserStores] = useState<StoreInfo[]>([]);
  const [tracking, setTracking] = useState<TrackedPkg[]>([]);
  const [measurements, setMeasurementsState] = useState<Measurements>(EMPTY_MEASUREMENTS);
  const [priceOverrides, setPriceOverridesState] = useState<Record<string, number>>({});
  const [storeSeen, setStoreSeen] = useState<Record<string, string[]>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [directory, setDirectory] = useState<StoreInfo[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [tagDefs, setTagDefs] = useState<TagDef[]>([]);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [agentRefs, setAgentRefs] = useState<Record<string, string>>({});
  // Blocks pushes until the initial pull after sign-in finishes, so local
  // defaults never clobber the cloud copy.
  const pulledRef = useRef(false);

  // Clerk is the identity layer; Supabase is the database, authorized by the
  // Clerk session token (see createClerkSupabaseClient). The session lives in a
  // ref so the Supabase client (built once per config) always reads the latest
  // token in its accessToken callback without being rebuilt on every change.
  const clerk = useClerk();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { session } = useSession();
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Resolve Supabase config (build-time env or the /api/env runtime fallback);
  // stays null (local-only mode) when neither has keys.
  const [config, setConfig] = useState<SupabaseConfig | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    resolveSupabaseConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sb = useMemo<SupabaseClient | null>(
    () =>
      config
        ? createClerkSupabaseClient(config, () => sessionRef.current?.getToken() ?? Promise.resolve(null))
        : null,
    [config],
  );

  const setAuthOpen = useCallback(
    (open: boolean) => {
      if (open) clerk.openSignIn();
    },
    [clerk],
  );

  useEffect(() => {
    setPrefsState({ ...DEFAULT_PREFS, ...read(K.prefs, {}) });
    setWishlist(read(K.wishlist, []));
    setCart(sanitizeItems(read(K.cart, [])));
    const storedHauls = sanitizeHauls(read(K.hauls, []));
    if (storedHauls.length > 0) setHauls(storedHauls);
    setLibrary(read(K.library, DEFAULT_LIBRARY_IDS));
    setFavStores(read(K.favStores, []));
    setUserStores(read(K.userStores, []));
    setTracking(read(K.tracking, []));
    setMeasurementsState(sanitizeMeasurements(read(K.measurements, EMPTY_MEASUREMENTS)));
    setPriceOverridesState(sanitizePriceOverrides(read(K.priceOverrides, {})));
    setStoreSeen(sanitizeStoreSeen(read(K.storeSeen, {})));
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
    window.localStorage.setItem(K.measurements, JSON.stringify(measurements));
    window.localStorage.setItem(K.priceOverrides, JSON.stringify(priceOverrides));
    window.localStorage.setItem(K.storeSeen, JSON.stringify(storeSeen));
  }, [hydrated, prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements, priceOverrides, storeSeen]);

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

  // Accent theme → CSS variables consumed by .flow-bg / .flow-text / .btn-glow / .card-pop.
  useEffect(() => {
    const { fg, ink } = ACCENTS[prefs.accent] ?? ACCENTS.mono;
    const root = document.documentElement;
    root.style.setProperty("--acc1", fg);
    root.style.setProperty("--acc-ink", ink);
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

  const addToCart = useCallback((item: Omit<SavedItem, "qty">, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.id === item.id);
      if (existing) {
        return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { ...item, qty }];
    });
  }, []);

  const setCartQty = useCallback((id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, qty: Math.floor(qty) } : l)),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const importCart = useCallback((items: SavedItem[]) => {
    setCart((prev) => {
      const next = [...prev];
      for (const item of items) {
        const i = next.findIndex((l) => l.id === item.id);
        if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + item.qty };
        else next.push(item);
      }
      return next;
    });
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
      prev.map((h) =>
        h.id === haulId ? { ...h, items: h.items.filter((i) => i.id !== itemId) } : h,
      ),
    );
  }, []);

  const assignCartToHaul = useCallback(
    (haulId: string) => {
      // Snapshot the cart here — state updaters must stay pure (React
      // double-invokes them in dev, which would double the quantities).
      const lines = cart;
      setHauls((prev) =>
        prev.map((h) => {
          if (h.id !== haulId) return h;
          const items = [...h.items];
          for (const line of lines) {
            const i = items.findIndex((x) => x.id === line.id);
            if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + line.qty };
            else items.push(line);
          }
          return { ...h, items };
        }),
      );
      setCart([]);
    },
    [cart],
  );

  // Shared payload for both haul and cart shares. `rate` is CNY→currency at
  // share time so images/preview render a stable secondary price.
  const buildShareRow = useCallback(
    (slug: string, kind: "haul" | "cart", name: string, items: SavedItem[], isPublic: boolean) => {
      const stats = haulStats(items);
      return {
        slug,
        owner_id: user!.id,
        owner_name: profileName ?? "Anonymous",
        owner_image: user!.image,
        kind,
        name,
        data: items,
        total_cny: stats.totalCny,
        unit_count: stats.unitCount,
        weight_g: stats.weightG,
        currency: prefs.currency,
        rate: prefs.currency === "CNY" ? 1 : rates[prefs.currency] ?? 0,
        public: isPublic,
        updated_at: new Date().toISOString(),
      };
    },
    [user, profileName, prefs.currency, rates],
  );

  const shareHaul = useCallback(
    async (haulId: string, opts?: { storeIds?: string[] }): Promise<string | null> => {
      if (!sb) {
        toast("Sharing needs cloud sync, which isn't configured here", "error");
        return null;
      }
      if (!user) {
        toast("Sign in to share a haul", "info");
        clerk.openSignIn();
        return null;
      }
      const haul = hauls.find((h) => h.id === haulId);
      if (!haul) return null;
      const items = opts?.storeIds?.length
        ? haul.items.filter((i) => opts.storeIds!.includes(i.storeId))
        : haul.items;
      if (items.length === 0) {
        toast("Nothing to share here", "error");
        return null;
      }
      const slug = haul.shareSlug ?? makeShareSlug();
      const isPublic = haul.sharePublic ?? true;
      const { error } = await sb
        .from("shared_hauls")
        .upsert(buildShareRow(slug, "haul", haul.name, items, isPublic), { onConflict: "slug" });
      if (error) {
        toast("Couldn't publish the haul — try again", "error");
        return null;
      }
      // Remember the slug so re-sharing updates the same link instead of minting a new one.
      setHauls((prev) =>
        prev.map((h) => (h.id === haulId ? { ...h, shareSlug: slug, sharePublic: isPublic } : h)),
      );
      return `${window.location.origin}/haul/${slug}`;
    },
    [sb, user, hauls, buildShareRow, clerk, toast],
  );

  const shareCart = useCallback(
    async (opts?: { storeIds?: string[] }): Promise<string | null> => {
      if (!sb) {
        toast("Sharing needs cloud sync, which isn't configured here", "error");
        return null;
      }
      if (!user) {
        toast("Sign in to share your cart", "info");
        clerk.openSignIn();
        return null;
      }
      const items = opts?.storeIds?.length
        ? cart.filter((i) => opts.storeIds!.includes(i.storeId))
        : cart;
      if (items.length === 0) {
        toast("Nothing to share here", "error");
        return null;
      }
      const slug = prefs.cartShareSlug ?? makeShareSlug();
      const { error } = await sb
        .from("shared_hauls")
        .upsert(buildShareRow(slug, "cart", "Cart", items, true), { onConflict: "slug" });
      if (error) {
        toast("Couldn't publish your cart — try again", "error");
        return null;
      }
      if (prefs.cartShareSlug !== slug) setPrefsState((p) => ({ ...p, cartShareSlug: slug }));
      return `${window.location.origin}/haul/${slug}`;
    },
    [sb, user, cart, prefs.cartShareSlug, buildShareRow, clerk, toast],
  );

  const unshareHaul = useCallback(
    async (haulId: string) => {
      const haul = hauls.find((h) => h.id === haulId);
      if (!sb || !haul?.shareSlug) return;
      await sb.from("shared_hauls").delete().eq("slug", haul.shareSlug);
      setHauls((prev) =>
        prev.map((h) =>
          h.id === haulId ? { ...h, shareSlug: undefined, sharePublic: undefined } : h,
        ),
      );
      toast("Haul unshared", "info");
    },
    [sb, hauls, toast],
  );

  const setHaulPublic = useCallback(
    async (haulId: string, next: boolean) => {
      const haul = hauls.find((h) => h.id === haulId);
      if (!sb || !haul?.shareSlug) return;
      const { error } = await sb
        .from("shared_hauls")
        .update({ public: next, updated_at: new Date().toISOString() })
        .eq("slug", haul.shareSlug);
      if (error) {
        toast("Couldn't update visibility — try again", "error");
        return;
      }
      setHauls((prev) => prev.map((h) => (h.id === haulId ? { ...h, sharePublic: next } : h)));
      toast(next ? "Haul is public" : "Haul is private", "info");
    },
    [sb, hauls, toast],
  );

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

  const setMeasurements = useCallback((update: Partial<Measurements>) => {
    setMeasurementsState((prev) => ({ ...prev, ...update }));
  }, []);

  const setPriceOverride = useCallback((id: string, price: number | null) => {
    setPriceOverridesState((prev) => {
      const next = { ...prev };
      if (price === null || !Number.isFinite(price) || price < 0) delete next[id];
      else next[id] = price;
      return next;
    });
  }, []);

  const markStoreSeen = useCallback((storeId: string, ids: string[]) => {
    if (!storeId || ids.length === 0) return;
    setStoreSeen((prev) => {
      const merged = new Set(prev[storeId] ?? []);
      let changed = false;
      for (const id of ids) if (!merged.has(id)) { merged.add(id); changed = true; }
      return changed ? { ...prev, [storeId]: [...merged] } : prev;
    });
  }, []);

  const addTracking = useCallback((pkg: TrackedPkg) => {
    setTracking((prev) => [pkg, ...prev.filter((p) => p.number !== pkg.number)]);
  }, []);

  const removeTracking = useCallback((number: string) => {
    setTracking((prev) => prev.filter((p) => p.number !== number));
  }, []);

  const snapshot = useMemo<CloudSnapshot>(
    () => ({ prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements, priceOverrides, storeSeen }),
    [prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements, priceOverrides, storeSeen],
  );

  const applySnapshot = useCallback((s: Partial<CloudSnapshot>) => {
    if (s.prefs) setPrefsState({ ...DEFAULT_PREFS, ...s.prefs });
    if (s.priceOverrides) setPriceOverridesState(sanitizePriceOverrides(s.priceOverrides));
    if (s.storeSeen) setStoreSeen(sanitizeStoreSeen(s.storeSeen));
    if (Array.isArray(s.wishlist)) setWishlist(s.wishlist);
    if (Array.isArray(s.cart)) setCart(sanitizeItems(s.cart));
    if (Array.isArray(s.hauls)) {
      const hauls = sanitizeHauls(s.hauls);
      if (hauls.length > 0) setHauls(hauls);
    }
    if (Array.isArray(s.library)) setLibrary(s.library);
    if (Array.isArray(s.favStores)) setFavStores(s.favStores);
    if (Array.isArray(s.userStores)) setUserStores(s.userStores);
    if (Array.isArray(s.tracking)) setTracking(s.tracking);
    if (s.measurements) setMeasurementsState(sanitizeMeasurements(s.measurements));
  }, []);

  // Identity comes from Clerk. Map its user onto our CloudUser shape; null when
  // signed out. Waits for Clerk to finish loading so we don't briefly report
  // "signed out" on refresh.
  useEffect(() => {
    if (!userLoaded) return;
    setUser(
      clerkUser
        ? {
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
            metaUsername: clerkUser.username ?? clerkUser.firstName ?? null,
            image: clerkUser.hasImage ? clerkUser.imageUrl : null,
          }
        : null,
    );
  }, [clerkUser, userLoaded]);

  // Public store directory + tag definitions (no sign-in required to read).
  const refreshDirectory = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb
      .from("store_directory")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setDirectory((data as DirectoryRow[]).map(rowToStore));
  }, [sb]);

  const refreshCatalogItems = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb
      .from("catalog_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCatalogItems((data as CatalogItemRow[]).map(rowToCatalogItem));
  }, [sb]);

  const refreshTagDefs = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("tag_defs").select("*").order("id");
    if (!error && data) setTagDefs(data as TagDef[]);
  }, [sb]);

  const refreshAgentRefs = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("agent_refs").select("*");
    if (!error && data) {
      const map: Record<string, string> = {};
      for (const row of data as { agent_id: string; code: string }[]) map[row.agent_id] = row.code;
      setAgentRefs(map);
    }
  }, [sb]);

  useEffect(() => {
    refreshDirectory();
    refreshTagDefs();
    refreshAgentRefs();
    refreshCatalogItems();
  }, [refreshDirectory, refreshTagDefs, refreshAgentRefs, refreshCatalogItems]);

  // Role tags + display name from the signed-in user's profile.
  //
  // Clerk users don't exist in Supabase's auth.users, so the old DB trigger
  // that created a profiles row on signup no longer fires — we create/refresh
  // the row here on sign-in instead (keyed by the Clerk user id, with email so
  // the owner bootstrap in schema.sql can match it). Then we read back the
  // authoritative tags/username. The own-row insert/update RLS policy on
  // profiles permits this; admin-assigned tags are preserved because upsert
  // only patches the columns we send.
  useEffect(() => {
    if (!sb || !user) {
      setProfileTags([]);
      setProfileName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const patch: Record<string, string> = { user_id: user.id };
      if (user.email) patch.email = user.email;
      if (user.metaUsername) patch.username = user.metaUsername;
      await sb.from("profiles").upsert(patch, { onConflict: "user_id" });

      const { data } = await sb
        .from("profiles")
        .select("tags, username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfileTags((data?.tags as string[] | undefined) ?? []);
      setProfileName((data?.username as string | null | undefined) ?? user.metaUsername ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, user]);

  // Pull the cloud copy once per sign-in. A missing row means a first-time
  // user — their local state gets pushed by the effect below.
  useEffect(() => {
    if (!sb || !user || !hydrated) return;
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
  }, [sb, user?.id, hydrated]);

  // Debounced push of every persisted change while signed in.
  useEffect(() => {
    if (!sb || !user || !hydrated || !pulledRef.current) return;
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
  }, [sb, snapshot, user, hydrated]);

  const applyRef = useCallback(
    (url: string | null, agentId: string) =>
      withRef(url, prefs.myRefs[agentId]?.trim() || agentRefs[agentId]),
    [prefs.myRefs, agentRefs],
  );

  // Sign-in, sign-up, and password management are all handled by Clerk's UI
  // (openSignIn / UserButton). Here we only wrap Clerk's signOut to also reset
  // sync state so the next sign-in re-pulls cleanly.
  const signOut = useCallback(async () => {
    await clerk.signOut();
    pulledRef.current = false;
    setSyncStatus("idle");
    setLastSyncAt(null);
    toast("Signed out — your data stays on this device", "info");
  }, [clerk, toast]);

  const syncNow = useCallback(async () => {
    if (!sb || !user) return;
    setSyncStatus("syncing");
    const { error } = await sb
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
  }, [sb, user, snapshot, toast]);

  const allStores = useMemo(
    () => [...STORES, ...directory, ...userStores],
    [directory, userStores],
  );

  // Admin UI visibility is driven purely by profile role tags — the owner's
  // email is never shipped to the client. The owner is bootstrapped with an
  // 'owner' tag server-side (see supabase/schema.sql), and the database's own
  // is_admin() RLS check is the real security gate regardless of this flag.
  const isAdmin = useMemo(
    () => user !== null && (profileTags.includes("admin") || profileTags.includes("owner")),
    [user, profileTags],
  );

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
      cartCount: cart.reduce((sum, l) => sum + l.qty, 0),
      cartOpen,
      setCartOpen,
      inCart: (id) => cart.some((l) => l.id === id),
      addToCart,
      setCartQty,
      removeFromCart,
      clearCart,
      hauls,
      activeHaul,
      createHaul,
      renameHaul,
      deleteHaul,
      setHaulBudget,
      removeFromHaul,
      importCart,
      assignCartToHaul,
      shareHaul,
      shareCart,
      unshareHaul,
      setHaulPublic,
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
      measurements,
      setMeasurements,
      priceOverrides,
      setPriceOverride,
      storeSeen,
      markStoreSeen,
      toasts,
      toast,
      cloudEnabled: sb !== null,
      sb,
      user,
      profileName,
      syncStatus,
      lastSyncAt,
      setAuthOpen,
      signOut,
      syncNow,
      agentRefs,
      refreshAgentRefs,
      applyRef,
      directory,
      refreshDirectory,
      catalogItems,
      refreshCatalogItems,
      tagDefs,
      refreshTagDefs,
      profileTags,
      isAdmin,
    }),
    [
      hydrated, prefs, setPrefs, rates, ratesLive, fmtCny, fmtConverted,
      wishlist, toggleWishlist, cart, cartOpen,
      addToCart, setCartQty, removeFromCart, importCart, clearCart,
      hauls, activeHaul, createHaul, renameHaul, deleteHaul, setHaulBudget,
      removeFromHaul, assignCartToHaul, shareHaul, shareCart, unshareHaul, setHaulPublic, allStores, library, favStores,
      addToLibrary, removeFromLibrary, toggleFavStore, submitStore,
      tracking, addTracking, removeTracking, measurements, setMeasurements,
      priceOverrides, setPriceOverride, storeSeen, markStoreSeen, toasts, toast,
      sb, user, profileName, syncStatus, lastSyncAt, setAuthOpen,
      signOut, syncNow,
      agentRefs, refreshAgentRefs, applyRef,
      directory, refreshDirectory, catalogItems, refreshCatalogItems, tagDefs, refreshTagDefs, profileTags, isAdmin,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

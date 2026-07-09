"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Currency, RateTable } from "./currency";
import { FALLBACK_RATES, convertCny, formatCnyWith, formatMoney } from "./currency";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AGENT_ID } from "./agents";
import { withRef } from "./links";
import { resolveSupabase } from "./supabase";
import { STORES, DEFAULT_LIBRARY_IDS } from "@/data/stores";
import type { StoreCategory, StoreInfo } from "@/data/stores";
import type { CatalogItem, Category } from "@/data/catalog";
import { EMPTY_MEASUREMENTS, type Measurements } from "./measurements";

/** Always treated as admin, before any profile tags load. */
export const OWNER_EMAIL = "ren.tipton@icloud.com";

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
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  signInWithEmail: (email: string, username: string) => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, username: string, agentId?: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [directory, setDirectory] = useState<StoreInfo[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [tagDefs, setTagDefs] = useState<TagDef[]>([]);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [agentRefs, setAgentRefs] = useState<Record<string, string>>({});
  const [authOpen, setAuthOpen] = useState(false);
  // Blocks pushes until the initial pull after sign-in finishes, so local
  // defaults never clobber the cloud copy.
  const pulledRef = useRef(false);

  // Resolve the Supabase client — from build-time env or the /api/env
  // runtime fallback. Stays null (local-only mode) when neither has keys.
  useEffect(() => {
    let cancelled = false;
    resolveSupabase().then((client) => {
      if (!cancelled) setSb(client);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [hydrated, prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements]);

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

  const addTracking = useCallback((pkg: TrackedPkg) => {
    setTracking((prev) => [pkg, ...prev.filter((p) => p.number !== pkg.number)]);
  }, []);

  const removeTracking = useCallback((number: string) => {
    setTracking((prev) => prev.filter((p) => p.number !== number));
  }, []);

  const snapshot = useMemo<CloudSnapshot>(
    () => ({ prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements }),
    [prefs, wishlist, cart, hauls, library, favStores, userStores, tracking, measurements],
  );

  const applySnapshot = useCallback((s: Partial<CloudSnapshot>) => {
    if (s.prefs) setPrefsState({ ...DEFAULT_PREFS, ...s.prefs });
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

  // Watch Supabase auth state. No-op in local-only mode.
  useEffect(() => {
    if (!sb) return;
    const toCloudUser = (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | undefined): CloudUser | null =>
      u
        ? {
            id: u.id,
            email: u.email ?? null,
            metaUsername: typeof u.user_metadata?.username === "string" ? (u.user_metadata.username as string) : null,
          }
        : null;
    sb.auth.getSession().then(({ data }) => {
      setUser(toCloudUser(data.session?.user));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(toCloudUser(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

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
  // BUG FIX: accounts created via the magic-link (email OTP) flow never went
  // through signUp(), so nothing ever wrote a profiles row — profileName
  // stayed null forever and the account showed up as a bare email with no
  // username, out of sync with password-created accounts. This now backfills
  // the profiles row from the auth metadata username (captured at sign-in
  // time, see toCloudUser above) whenever the row is missing or empty, so
  // every account — password or magic-link — ends up with a real username.
  useEffect(() => {
    if (!sb || !user) {
      setProfileTags([]);
      setProfileName(null);
      return;
    }
    let cancelled = false;
    sb.from("profiles")
      .select("tags, username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;
        const tags = (data?.tags as string[] | undefined) ?? [];
        const existingUsername = (data?.username as string | null | undefined) ?? null;
        setProfileTags(tags);
        if (existingUsername) {
          setProfileName(existingUsername);
          return;
        }
        if (!user.metaUsername) {
          setProfileName(null);
          return;
        }
        // No profiles row, or one with a blank username — backfill it now.
        const { error } = await sb
          .from("profiles")
          .upsert({ user_id: user.id, username: user.metaUsername, tags });
        if (!cancelled) setProfileName(error ? null : user.metaUsername);
      });
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

  const signInWithEmail = useCallback(
    // BUG FIX: magic-link sign-in used to create the account with no
    // username at all (no `data` was ever passed to signInWithOtp), so
    // magic-link accounts came out permanently blank/mismatched next to
    // password accounts. Username is now required by the caller (AuthModal)
    // and stamped into the same auth metadata signUp() uses, so the
    // profiles-backfill effect above picks it up identically either way.
    async (email: string, username: string) => {
      if (!sb) return false;
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { data: { username }, emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast(error.message, "error");
        return false;
      }
      toast("Check your email for the sign-in link", "info");
      return true;
    },
    [sb, toast],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!sb) return false;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        toast(error.message, "error");
        return false;
      }
      toast("Signed in");
      return true;
    },
    [sb, toast],
  );

  const signUp = useCallback(
    async (email: string, password: string, username: string, agentId?: string) => {
      if (!sb) return false;
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast(error.message, "error");
        return false;
      }
      if (agentId) setPrefsState((prev) => ({ ...prev, agentId }));
      if (data.session) toast(`Welcome, ${username}!`);
      else toast("Account created — check your email to confirm, then sign in", "info");
      return true;
    },
    [sb, toast],
  );

  const applyRef = useCallback(
    (url: string | null, agentId: string) =>
      withRef(url, prefs.myRefs[agentId]?.trim() || agentRefs[agentId]),
    [prefs.myRefs, agentRefs],
  );

  // BUG FIX: magic-link accounts previously had no way to ever set a
  // password, permanently locking them out of password sign-in on another
  // device. Safe to call any time while signed in — no plaintext password
  // ever has to survive the email-redirect round trip.
  const updatePassword = useCallback(
    async (password: string) => {
      if (!sb || !user) return false;
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        toast(error.message, "error");
        return false;
      }
      toast("Password set");
      return true;
    },
    [sb, user, toast],
  );

  const signOut = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
    pulledRef.current = false;
    setSyncStatus("idle");
    setLastSyncAt(null);
    toast("Signed out — your data stays on this device", "info");
  }, [sb, toast]);

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

  const isAdmin = useMemo(
    () =>
      user !== null &&
      (user.email === OWNER_EMAIL ||
        profileTags.includes("admin") ||
        profileTags.includes("owner")),
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
      toasts,
      toast,
      cloudEnabled: sb !== null,
      sb,
      user,
      profileName,
      syncStatus,
      lastSyncAt,
      authOpen,
      setAuthOpen,
      signInWithEmail,
      signInWithPassword,
      signUp,
      updatePassword,
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
      removeFromHaul, assignCartToHaul, allStores, library, favStores,
      addToLibrary, removeFromLibrary, toggleFavStore, submitStore,
      tracking, addTracking, removeTracking, measurements, setMeasurements, toasts, toast,
      sb, user, profileName, syncStatus, lastSyncAt, authOpen,
      signInWithEmail, signInWithPassword, signUp, updatePassword, signOut, syncNow,
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

/**
 * Public-profile + collection shapes. Kept out of the "use client" store module
 * so the server-rendered profile page (/u/[handle]) can import the types and
 * sanitizers without pulling in a client boundary — same split as shareHaul.ts.
 */

/** One owned piece in a shopper's collection: a product plus their size + quick review. */
export interface CollectionPiece {
  /** Reuses the source item id (`album:*` / `cat:*`) so it links to the exact product; `manual:*` for hand-added. */
  id: string;
  title: string;
  image: string | null;
  imgHost: string | null;
  storeId: string;
  storeName: string;
  url: string | null;
  /** The size the owner actually has. */
  size: string;
  /** 0 = unrated, otherwise 1–5. */
  rating: number;
  review: string;
  addedAt: number;
}

/** A followed store as shown on a public profile. */
export interface ProfileStore {
  id: string;
  name: string;
  url: string;
  image: string | null;
  categories: string[];
}

/** A published profile as read back from public_profiles for the public page. */
export interface PublicProfile {
  handle: string;
  displayName: string;
  image: string | null;
  bio: string;
  showCollection: boolean;
  showStores: boolean;
  collection: CollectionPiece[];
  stores: ProfileStore[];
}

/** Turn a username/display name into a URL-safe profile handle. */
export function slugifyHandle(s: string): string {
  const base = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return base || "user";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Validate/clean the collection jsonb read back from the database (or localStorage). */
export function sanitizeCollection(value: unknown): CollectionPiece[] {
  if (!Array.isArray(value)) return [];
  const out: CollectionPiece[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.title !== "string") continue;
    const rating = Math.max(0, Math.min(5, Math.round(num(r.rating, 0))));
    out.push({
      id: r.id,
      title: r.title,
      image: typeof r.image === "string" ? r.image : null,
      imgHost: typeof r.imgHost === "string" ? r.imgHost : null,
      storeId: str(r.storeId),
      storeName: str(r.storeName),
      url: typeof r.url === "string" ? r.url : null,
      size: str(r.size),
      rating,
      review: str(r.review),
      addedAt: num(r.addedAt, Date.now()),
    });
  }
  return out;
}

/** Validate/clean the followed-store jsonb read back from the database. */
export function sanitizeProfileStores(value: unknown): ProfileStore[] {
  if (!Array.isArray(value)) return [];
  const out: ProfileStore[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string") continue;
    out.push({
      id: r.id,
      name: r.name,
      url: str(r.url),
      image: typeof r.image === "string" ? r.image : null,
      categories: Array.isArray(r.categories) ? r.categories.filter((c): c is string => typeof c === "string") : [],
    });
  }
  return out;
}

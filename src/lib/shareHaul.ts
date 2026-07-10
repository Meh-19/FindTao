/**
 * Self-contained snapshot shapes for shared hauls (the shared_hauls.data JSON).
 * Kept out of the client store module so server routes — the share page and the
 * OG image — can import these without pulling in a "use client" boundary. The
 * fields mirror SavedItem so a shared item round-trips back into the cart on
 * "Clone this haul".
 */
export interface SharedItem {
  id: string;
  title: string;
  priceCny: number | null;
  qty: number;
  image: string | null;
  imgHost: string | null;
  storeId: string;
  storeName: string;
  url: string | null;
}

export interface SharedHaul {
  slug: string;
  ownerName: string;
  name: string;
  items: SharedItem[];
  totalCny: number;
  unitCount: number;
  weightG: number;
  public: boolean;
}

/** Validate/clean the jsonb `data` array read back from the database. */
export function sanitizeSharedItems(value: unknown): SharedItem[] {
  if (!Array.isArray(value)) return [];
  const out: SharedItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Partial<SharedItem>;
    if (typeof r.title !== "string") continue;
    out.push({
      id: typeof r.id === "string" ? r.id : "",
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

/** Short, URL-safe, unambiguous share slug (no 0/o/1/l/i). */
export function makeShareSlug(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  let s = "";
  for (const b of arr) s += alphabet[b % alphabet.length];
  return s;
}

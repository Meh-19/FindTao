import type { SavedItem } from "./store";

/**
 * Compact cart serialization for share links (/browse?cart=…). Items pack
 * into positional tuples, JSON-encoded, then base64url — self-contained so
 * the recipient doesn't need the sender's store data.
 */
type Packed = [
  string, // id
  string, // title
  number | null, // priceCny
  number, // qty
  string | null, // image
  string | null, // imgHost
  string, // storeId
  string, // storeName
  string | null, // url
];

export function encodeCart(items: SavedItem[]): string {
  const packed: Packed[] = items.map((i) => [
    i.id, i.title, i.priceCny, i.qty, i.image, i.imgHost, i.storeId, i.storeName, i.url,
  ]);
  const bytes = new TextEncoder().encode(JSON.stringify(packed));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCart(param: string): SavedItem[] | null {
  try {
    const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const packed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!Array.isArray(packed)) return null;
    const items: SavedItem[] = [];
    for (const p of packed) {
      if (!Array.isArray(p) || typeof p[0] !== "string" || typeof p[1] !== "string") continue;
      items.push({
        id: p[0],
        title: p[1],
        priceCny: typeof p[2] === "number" ? p[2] : null,
        qty: typeof p[3] === "number" && p[3] >= 1 ? Math.floor(p[3]) : 1,
        image: typeof p[4] === "string" ? p[4] : null,
        imgHost: typeof p[5] === "string" ? p[5] : null,
        storeId: typeof p[6] === "string" ? p[6] : "",
        storeName: typeof p[7] === "string" ? p[7] : "",
        url: typeof p[8] === "string" ? p[8] : null,
      });
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

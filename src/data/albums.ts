import type { StoreCategory, StoreInfo } from "./stores";

export interface Album {
  id: string;
  name: string;
  photoCount: number;
  /** Gradient seeds for the cover and photo tiles — swapped for real images later. */
  hue: [string, string];
}

const ALBUM_NAMES: Record<StoreCategory, string[]> = {
  Clothing: ["New arrivals", "Outerwear", "Knits & fleece", "Shirts", "Denim", "Spring drop", "Archive"],
  Shoes: ["New arrivals", "Court classics", "Retro runners", "Boots", "Restocks", "Sale rack"],
  Bags: ["New arrivals", "Backpacks", "Crossbody", "Totes", "Pouches & SLG"],
  Jewelry: ["New arrivals", "Chains", "Rings", "Pendants", "Earrings"],
  Accessories: ["New arrivals", "Caps & beanies", "Belts", "Eyewear", "Small goods"],
  Basics: ["New arrivals", "Tees", "Heavyweight blanks", "Fleece", "Multipacks"],
};

/** Small deterministic hash so a store always gets the same albums. */
function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Placeholder album list derived from the store's categories and hue.
 * Deterministic per store; replaced by the Yupoo/data pipeline later.
 */
export function storeAlbums(store: StoreInfo): Album[] {
  const base = seed(store.id);
  const names = [...new Set(store.categories.flatMap((c) => ALBUM_NAMES[c]))];
  const count = Math.min(names.length, 4 + (base % 4));
  return names.slice(0, count).map((name, i) => {
    const s = seed(`${store.id}:${name}`);
    return {
      id: `${store.id}-album-${i}`,
      name,
      photoCount: 6 + (s % 19),
      hue: [shade(store.hue[0], ((s % 5) - 2) * 18), shade(store.hue[1], ((s % 7) - 3) * 14)],
    };
  });
}

export type StoreCategory = "Clothing" | "Shoes" | "Bags" | "Jewelry" | "Accessories" | "Basics";

export interface StoreInfo {
  id: string;
  name: string;
  url: string;
  categories: StoreCategory[];
  hue: [string, string];
  trust: number;
  blurb: string;
  albums: number;
  /** Community-submitted stores show up in Discover but not the default library. */
  community: boolean;
}

/** Seed store directory. Replace with the real data pipeline + community submissions. */
export const STORES: StoreInfo[] = [
  { id: "kapital-studio", name: "Kapital Studio", url: "https://weidian.com/?userid=1690001", categories: ["Clothing"], hue: ["#8b5cf6", "#ec4899"], trust: 92, blurb: "Japanese-inspired outerwear and knits.", albums: 181, community: false },
  { id: "blank-archive", name: "Blank Archive", url: "https://shop101.taobao.com", categories: ["Basics", "Clothing"], hue: ["#6366f1", "#22d3ee"], trust: 88, blurb: "Heavyweight blanks — tees, fleece, zips.", albums: 96, community: false },
  { id: "trainer-loft", name: "Trainer Loft", url: "https://weidian.com/?userid=1690002", categories: ["Shoes"], hue: ["#10b981", "#22d3ee"], trust: 95, blurb: "GATs, retro runners, court classics.", albums: 240, community: false },
  { id: "indigo-works", name: "Indigo Works", url: "https://shop102.taobao.com", categories: ["Clothing"], hue: ["#3b82f6", "#8b5cf6"], trust: 84, blurb: "Selvedge denim, straight and relaxed cuts.", albums: 58, community: false },
  { id: "cargo-supply", name: "Cargo Supply", url: "https://detail.1688.com/shop/1690003", categories: ["Bags", "Accessories"], hue: ["#f59e0b", "#ef4444"], trust: 78, blurb: "Ballistic nylon, canvas, and techwear carry.", albums: 112, community: false },
  { id: "knit-theory", name: "Knit Theory", url: "https://weidian.com/?userid=1690004", categories: ["Clothing"], hue: ["#d946ef", "#8b5cf6"], trust: 90, blurb: "Mohair, jacquard, and loose-gauge knitwear.", albums: 74, community: false },
  { id: "tannery-row", name: "Tannery Row", url: "https://shop103.taobao.com", categories: ["Accessories"], hue: ["#f59e0b", "#d97706"], trust: 86, blurb: "Veg-tan leather goods, brass hardware.", albums: 43, community: false },
  { id: "workwear-dept", name: "Workwear Dept", url: "https://weidian.com/?userid=1690005", categories: ["Clothing"], hue: ["#84cc16", "#10b981"], trust: 81, blurb: "Double-knee, carpenter, and chore staples.", albums: 88, community: false },
  { id: "track-club", name: "Track Club", url: "https://shop104.taobao.com", categories: ["Shoes"], hue: ["#ef4444", "#ec4899"], trust: 73, blurb: "Nylon retro runners and racing flats.", albums: 66, community: false },
  { id: "argent-lab", name: "Argent Lab", url: "https://shop105.taobao.com", categories: ["Jewelry"], hue: ["#94a3b8", "#67e8f9"], trust: 91, blurb: "925 silver chains, rings, and pendants.", albums: 51, community: false },
  { id: "mobius-studio", name: "Mobius Studio", url: "https://weidian.com/?userid=1690006", categories: ["Clothing", "Accessories"], hue: ["#14b8a6", "#3b82f6"], trust: 87, blurb: "Avant basics and asymmetric cuts.", albums: 35, community: true },
  { id: "hotdog-official", name: "Hotdog Official", url: "https://weidian.com/?userid=1690007", categories: ["Clothing"], hue: ["#f97316", "#ef4444"], trust: 82, blurb: "Graphic-heavy streetwear drops.", albums: 372, community: true },
  { id: "survival-source", name: "Survival Source", url: "https://shop106.taobao.com", categories: ["Bags", "Accessories"], hue: ["#8b5cf6", "#22d3ee"], trust: 79, blurb: "Outdoor-leaning packs and pouches.", albums: 184, community: true },
  { id: "union-kingdom", name: "Union Kingdom", url: "https://weidian.com/?userid=1690008", categories: ["Shoes", "Clothing"], hue: ["#22c55e", "#eab308"], trust: 76, blurb: "Mixed catalog — verify per item.", albums: 77, community: true },
];

export const STORE_CATEGORIES: StoreCategory[] = ["Clothing", "Shoes", "Bags", "Jewelry", "Accessories", "Basics"];

export const DEFAULT_LIBRARY_IDS = STORES.filter((s) => !s.community).map((s) => s.id);

export function getStore(id: string): StoreInfo | undefined {
  return STORES.find((s) => s.id === id);
}

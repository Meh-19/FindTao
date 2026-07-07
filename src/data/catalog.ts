import type { Marketplace, ParsedLink } from "@/lib/links";
import { canonicalUrl } from "@/lib/links";
import { getStore } from "./stores";
import type { StoreInfo } from "./stores";

export type Category = "jacket" | "hoodie" | "tee" | "pants" | "shoes" | "bag" | "accessory";

export interface CatalogItem {
  id: string;
  title: string;
  marketplace: Marketplace;
  itemId: string;
  priceCny: number;
  category: Category;
  storeId: string;
  qcCount: number;
  tags: string[];
  /** Placeholder tile gradient [from, to] until real (proxied) images exist. */
  hue: [string, string];
  fitNote?: string;
}

/** Per-category shipping weight estimates (grams) for haul totals. */
export const CATEGORY_WEIGHT_G: Record<Category, number> = {
  jacket: 900,
  hoodie: 650,
  tee: 250,
  pants: 750,
  shoes: 1250,
  bag: 800,
  accessory: 180,
};

export function itemLink(item: CatalogItem): ParsedLink {
  return { marketplace: item.marketplace, itemId: item.itemId, rawUrl: canonicalUrl(item.marketplace, item.itemId) };
}

export function itemStore(item: CatalogItem): StoreInfo {
  const store = getStore(item.storeId);
  if (!store) throw new Error(`Unknown store: ${item.storeId}`);
  return store;
}

/** Mock catalog. Replace with the real data pipeline (agent API / affiliate feed). */
export const CATALOG: CatalogItem[] = [
  {
    id: "wool-varsity-jacket",
    title: "Wool varsity jacket with leather sleeves",
    marketplace: "weidian",
    itemId: "7234567890",
    priceCny: 168,
    category: "jacket",
    storeId: "kapital-studio",
    qcCount: 42,
    tags: ["varsity", "wool", "streetwear"],
    hue: ["#8b5cf6", "#ec4899"],
    fitNote: "Runs small — most buyers size up one.",
  },
  {
    id: "heavyweight-boxy-tee",
    title: "305gsm heavyweight boxy tee",
    marketplace: "taobao",
    itemId: "675330292891",
    priceCny: 45,
    category: "tee",
    storeId: "blank-archive",
    qcCount: 127,
    tags: ["basics", "boxy", "cotton"],
    hue: ["#6366f1", "#22d3ee"],
    fitNote: "True to size, boxy cut.",
  },
  {
    id: "suede-german-army-trainers",
    title: "Suede German Army Trainers",
    marketplace: "weidian",
    itemId: "7301122334",
    priceCny: 258,
    category: "shoes",
    storeId: "trainer-loft",
    qcCount: 89,
    tags: ["GAT", "suede", "sneakers"],
    hue: ["#10b981", "#22d3ee"],
    fitNote: "Runs half a size large.",
  },
  {
    id: "washed-raw-denim",
    title: "14oz washed selvedge denim, straight cut",
    marketplace: "taobao",
    itemId: "689445566778",
    priceCny: 199,
    category: "pants",
    storeId: "indigo-works",
    qcCount: 31,
    tags: ["denim", "selvedge", "straight"],
    hue: ["#3b82f6", "#8b5cf6"],
  },
  {
    id: "nylon-messenger-bag",
    title: "Ballistic nylon messenger bag",
    marketplace: "1688",
    itemId: "678901234567",
    priceCny: 89,
    category: "bag",
    storeId: "cargo-supply",
    qcCount: 12,
    tags: ["techwear", "nylon", "messenger"],
    hue: ["#f59e0b", "#ef4444"],
  },
  {
    id: "mohair-cardigan",
    title: "Loose-knit mohair blend cardigan",
    marketplace: "weidian",
    itemId: "7412233445",
    priceCny: 145,
    category: "hoodie",
    storeId: "knit-theory",
    qcCount: 56,
    tags: ["knitwear", "mohair", "grunge"],
    hue: ["#d946ef", "#8b5cf6"],
    fitNote: "Oversized by design — size down for a normal fit.",
  },
  {
    id: "leather-belt-brass",
    title: "Vegetable-tanned leather belt, brass buckle",
    marketplace: "taobao",
    itemId: "692233445566",
    priceCny: 65,
    category: "accessory",
    storeId: "tannery-row",
    qcCount: 23,
    tags: ["leather", "belt", "brass"],
    hue: ["#f59e0b", "#d97706"],
  },
  {
    id: "cargo-work-pants",
    title: "Double-knee cargo work pants",
    marketplace: "weidian",
    itemId: "7523344556",
    priceCny: 132,
    category: "pants",
    storeId: "workwear-dept",
    qcCount: 44,
    tags: ["cargo", "workwear", "double-knee"],
    hue: ["#84cc16", "#10b981"],
  },
  {
    id: "retro-running-shoes",
    title: "Retro nylon running shoes",
    marketplace: "taobao",
    itemId: "701122334455",
    priceCny: 178,
    category: "shoes",
    storeId: "track-club",
    qcCount: 8,
    tags: ["retro", "running", "nylon"],
    hue: ["#ef4444", "#ec4899"],
    fitNote: "True to size.",
  },
  {
    id: "zip-hoodie-fleece",
    title: "450gsm fleece full-zip hoodie",
    marketplace: "weidian",
    itemId: "7634455667",
    priceCny: 118,
    category: "hoodie",
    storeId: "blank-archive",
    qcCount: 71,
    tags: ["basics", "fleece", "zip"],
    hue: ["#22c55e", "#14b8a6"],
    fitNote: "True to size, slightly long sleeves.",
  },
  {
    id: "canvas-tote-bag",
    title: "Heavy canvas tote with internal pocket",
    marketplace: "1688",
    itemId: "681234509876",
    priceCny: 32,
    category: "bag",
    storeId: "cargo-supply",
    qcCount: 5,
    tags: ["canvas", "tote", "basics"],
    hue: ["#eab308", "#f97316"],
  },
  {
    id: "silver-curb-chain",
    title: "925 silver curb chain, 5mm",
    marketplace: "taobao",
    itemId: "715566778899",
    priceCny: 210,
    category: "accessory",
    storeId: "argent-lab",
    qcCount: 38,
    tags: ["jewelry", "silver", "chain"],
    hue: ["#94a3b8", "#67e8f9"],
  },
];

export function getItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

export function storeItems(storeId: string): CatalogItem[] {
  return CATALOG.filter((i) => i.storeId === storeId);
}

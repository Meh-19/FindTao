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

/**
 * The catalog fills from the real data pipeline (agent API / affiliate feed).
 * Mock seed items were removed for launch; search and item pages show their
 * empty states until real finds land.
 */
export const CATALOG: CatalogItem[] = [];

export function getItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

export function storeItems(storeId: string): CatalogItem[] {
  return CATALOG.filter((i) => i.storeId === storeId);
}

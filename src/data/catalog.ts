import type { Marketplace, ParsedLink } from "@/lib/links";
import { canonicalUrl } from "@/lib/links";

export type Category = "jacket" | "hoodie" | "tee" | "pants" | "shoes" | "bag" | "accessory";

/** Minimal store info a catalog item needs to render — see itemStore() below for why this isn't a live lookup. */
export interface ItemStoreInfo {
  id: string;
  name: string;
  trust: number;
}

export interface CatalogItem {
  id: string;
  title: string;
  marketplace: Marketplace;
  itemId: string;
  priceCny: number;
  category: Category;
  storeId: string;
  /** Denormalized from the store at add-time — see the schema comment on catalog_items. */
  storeName: string;
  storeTrust: number;
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

/**
 * Catalog items store their own denormalized store name/trust rather than
 * joining against a live store list — the catalog previously joined against
 * a static STORES array that's intentionally always empty (the real
 * directory only exists in Supabase), which meant this threw for every
 * real item. No lookup, no failure mode.
 */
export function itemStore(item: CatalogItem): ItemStoreInfo {
  return { id: item.storeId, name: item.storeName, trust: item.storeTrust };
}

export function getItem(items: CatalogItem[], id: string): CatalogItem | undefined {
  return items.find((i) => i.id === id);
}

export function storeItems(items: CatalogItem[], storeId: string): CatalogItem[] {
  return items.filter((i) => i.storeId === storeId);
}

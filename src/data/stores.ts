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
  /** Community/directory stores show up in Discover but not the default library. */
  community: boolean;
  /** Directory tags assigned from the dev panel (hot, popular, trusted seller, …). */
  tags?: string[];
  /** Directory-managed flags — set from the dev panel. */
  discover?: boolean;
  banned?: boolean;
}

/**
 * The live store directory comes from Supabase (`store_directory`, managed at
 * /dev) plus each user's own added stores. No hardcoded seeds ship anymore.
 */
export const STORES: StoreInfo[] = [];

export const STORE_CATEGORIES: StoreCategory[] = ["Clothing", "Shoes", "Bags", "Jewelry", "Accessories", "Basics"];

export const DEFAULT_LIBRARY_IDS: string[] = [];

export function getStore(id: string): StoreInfo | undefined {
  return STORES.find((s) => s.id === id);
}

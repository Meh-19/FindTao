import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { serverSupabase } from "@/lib/serverSupabase";

// The directory changes slowly — refresh hourly rather than rebuilding the
// sitemap (which queries Supabase) on every crawl.
export const revalidate = 3600;

/** Public, indexable static routes — personal/utility pages are left out. */
const STATIC_PATHS = [
  "",
  "/browse",
  "/discover",
  "/drops",
  "/hauls",
  "/w2c",
  "/advisor",
  "/convert",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  // Store + item pages live in Supabase (the static arrays are empty). Anon RLS
  // exposes exactly the public rows, so the sitemap mirrors what's browsable.
  const sb = serverSupabase();
  if (sb) {
    const { data: stores } = await sb
      .from("store_directory")
      .select("id")
      .eq("discover", true)
      .eq("banned", false);
    for (const s of stores ?? []) {
      entries.push({ url: `${SITE_URL}/store/${s.id}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    }
    const { data: items } = await sb.from("catalog_items").select("id");
    for (const it of items ?? []) {
      entries.push({ url: `${SITE_URL}/item/${it.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    }
  }

  return entries;
}

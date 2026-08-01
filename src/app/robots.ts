import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Let crawlers index the public, shareable surface (home, discover, stores,
 * items, public profiles, shared hauls) but keep API routes and personal/admin
 * pages out — they hold no indexable content and just waste crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dev", "/settings", "/sign-in", "/sign-up"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

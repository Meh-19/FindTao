/**
 * Canonical site origin, shared by sitemap/robots/manifest and every page's
 * metadata. `||` (not `??`) so an empty build-time env still falls back rather
 * than yielding "" — see the same guard in app/layout.tsx.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "FindTao";

export const SITE_DESCRIPTION =
  "Browse Taobao, Weidian, 1688 and Xianyu finds from anywhere. Plan hauls, check QC photos, and hand off to your shopping agent in one click.";

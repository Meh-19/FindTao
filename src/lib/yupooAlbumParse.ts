/**
 * Pure HTML parsers for a Yupoo album page — split out from the album API route
 * so they can be unit-tested without a network round-trip. The route fetches
 * the page and delegates all extraction here.
 */

export function decodeEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * Direct marketplace hosts only — deliberately NOT agent hosts. Sellers paste
 * pre-built agent links carrying their own referral code, and those links are
 * sometimes wrong (seen in the wild: a Kakobuy link pointing at a different
 * album's item). Matching only bare marketplace URLs means the app rebuilds
 * every agent link itself, from an id it parsed. Encoded copies inside agent
 * URLs (`https%3A%2F%2Fitem.taobao.com...`) can't match this, which is the point.
 */
const linkRe =
  /https?:\/\/(?:(?:item|detail|world|main|h5)\.(?:taobao|tmall)\.com|(?:www\.)?weidian\.com|detail\.1688\.com|(?:www\.)?goofish\.com)[^"'<>\s]*/g;

/** Distinct marketplace item URLs in the given text, capped — a description lists a handful at most. */
export function extractItemLinks(source: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const m of source.matchAll(linkRe)) {
    const url = m[0];
    if (!seen.has(url) && links.length < 5) {
      seen.add(url);
      links.push(url);
    }
  }
  return links;
}

/**
 * The album's real description — sellers write the CNY price ("￥270") as the
 * very first line, followed by the Taobao/Weidian links — lives in the
 * page's `ImageGallery` JSON-LD block as plain, un-entity-encoded text. The
 * page actually ships several `<script type="application/ld+json">` blocks
 * (Organization, BreadcrumbList ×2, ImageGallery) so this has to find the
 * right one specifically rather than grabbing the first — that's the
 * Organization block, which has no description at all. That's a much
 * cleaner source than scanning the whole HTML: the meta tags carry the same
 * text but HTML-entity-encoded (used here only as a fallback), and scanning
 * the full page risks picking up unrelated links from nav/sidebar albums.
 */
export function extractDescription(html: string): string | null {
  const gallery = extractImageGallery(html);
  if (gallery && typeof gallery.description === "string") return gallery.description;
  const meta = html.match(/<meta name="description" itemprop="description" content="([\s\S]*?)"\s*\/?>/);
  return meta ? decodeEntities(meta[1]) : null;
}

/**
 * The album's own title, from the same ImageGallery block (its `name`). A URL
 * deep-link (`/store/x?album=123`) carries no title, so without this an album
 * whose price lives *in its title* would read as "price not listed" until the
 * shopper found it in the grid. Falls back to the `og:title` (`"¥369 | 相册 |
 * host | …"` — take the part before the first separator).
 */
export function extractTitle(html: string): string | null {
  const gallery = extractImageGallery(html);
  if (gallery && typeof gallery.name === "string" && gallery.name.trim()) return gallery.name.trim();
  const og = html.match(/<meta property="og:title" content="([^"]*)"/);
  if (og) {
    const title = decodeEntities(og[1]).split("|")[0].trim();
    if (title) return title;
  }
  return null;
}

/** Parse the page's ImageGallery JSON-LD block (name + description live here). */
function extractImageGallery(html: string): { name?: string; description?: string } | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as { "@type"?: string; name?: string; description?: string };
      if (data["@type"] === "ImageGallery") return data;
    } catch {
      // malformed block — keep looking at the rest
    }
  }
  return null;
}

/**
 * Every Yupoo photo is published at several sizes under one hash —
 * `photo.yupoo.com/<user>/<hash>/big.jpg`, `/square.jpg`, `/small.jpg`,
 * `/medium.jpg` — and the album markup carries more than one of them in
 * `data-src`. Deduping by exact URL (as we used to) let both the full image and
 * its thumbnail through, so the viewer showed every photo twice — once sharp,
 * once low-res. Group by hash instead and keep the highest-quality variant,
 * preserving first-seen order.
 */
const VARIANT_RANK: Record<string, number> = { big: 4, medium: 3, small: 2, square: 1 };

export function extractPhotos(html: string): string[] {
  const byHash = new Map<string, { url: string; rank: number; order: number }>();
  let order = 0;
  for (const m of html.matchAll(/data-src="((?:https?:)?\/\/photo\.yupoo\.com[^"]+)"/g)) {
    const url = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
    const parts = url.match(/photo\.yupoo\.com\/[^/]+\/([^/]+)\/([a-z]+)\.(?:jpe?g|png|webp)/i);
    const hash = parts ? parts[1] : url; // fall back to the whole url if the shape is unexpected
    const rank = parts ? (VARIANT_RANK[parts[2].toLowerCase()] ?? 3) : 3;
    const existing = byHash.get(hash);
    if (!existing) {
      byHash.set(hash, { url, rank, order: order++ });
    } else if (rank > existing.rank) {
      existing.url = url;
      existing.rank = rank; // upgrade to the sharper variant, keep its slot
    }
  }
  return [...byHash.values()].sort((a, b) => a.order - b.order).map((v) => v.url);
}

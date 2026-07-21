import { isValidYupooHost } from "@/lib/yupoo";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// The store-page price prefetch fires one of these per visible album (light
// mode) — up to 120 on the first page, plus another ~120 each time the
// shopper hits "load more", plus the full fetch when they open an album, all
// sharing this per-IP bucket. Kept high enough that ordinary multi-page
// browsing never trips it; the client also backs off on 429 rather than
// dropping the price. This ceiling is just a backstop against scripted scraping.
const LIMIT = 300;
const WINDOW_MS = 60_000;

function decodeEntities(s: string): string {
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
function extractItemLinks(source: string): string[] {
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
function extractDescription(html: string): string | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as { "@type"?: string; description?: string };
      if (data["@type"] === "ImageGallery" && typeof data.description === "string") {
        return data.description;
      }
    } catch {
      // malformed block — keep looking at the rest
    }
  }
  const meta = html.match(/<meta name="description" itemprop="description" content="([\s\S]*?)"\s*\/?>/);
  return meta ? decodeEntities(meta[1]) : null;
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

function extractPhotos(html: string): string[] {
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

/**
 * Scrape one Yupoo album: the photo list, the seller's description (price +
 * marketplace links live here — see extractDescription above), and any
 * Taobao/Tmall/Weidian/1688 item links found in it. Those power the price
 * display and the buy-via-agent button in the album viewer.
 */
export async function GET(request: Request) {
  const rl = rateLimit(`yupoo-album:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl, "Too many requests — try again shortly.");

  const params = new URL(request.url).searchParams;
  const host = params.get("host") ?? "";
  const id = params.get("id") ?? "";
  // Store pages bulk-prefetch the description (for price + the seller's
  // marketplace links) of every album on load — `light=1` skips the photo-list
  // scan for those calls so the response for ~20 parallel requests isn't
  // dragging a full photo array each. The full fetch (photos included) still
  // runs when a shopper actually opens the album.
  const light = params.get("light") === "1";
  if (!isValidYupooHost(host) || !/^\d+$/.test(id)) {
    return Response.json({ error: "invalid params" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://${host}.x.yupoo.com/albums/${id}?uid=1`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      return Response.json({ error: `yupoo responded ${res.status}` }, { status: 502 });
    }
    const html = await res.text();

    const description = extractDescription(html);

    // Scan the description first (accurate — it's just this album's text). The
    // whole-page fallback is full-fetch only: it's the less accurate source
    // (nav/sidebar albums leak in) and light mode runs ~120× per store load,
    // so paying for it in bulk buys inaccuracy at scale.
    const links = extractItemLinks(light ? (description ?? "") : (description ?? decodeEntities(html)));

    if (light) {
      return Response.json(
        { description, links },
        { headers: { "Cache-Control": "public, max-age=900" } },
      );
    }

    const photos = extractPhotos(html);

    return Response.json(
      { photos, links, description },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

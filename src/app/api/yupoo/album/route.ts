import { isValidYupooHost } from "@/lib/yupoo";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { fetchUpstream } from "@/lib/fetchUpstream";
import {
  decodeEntities,
  extractDescription,
  extractItemLinks,
  extractPhotos,
  extractTitle,
} from "@/lib/yupooAlbumParse";

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
    const res = await fetchUpstream(`https://${host}.x.yupoo.com/albums/${id}?uid=1`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 900 },
    });
    if (!res) {
      return Response.json({ error: "yupoo unreachable" }, { status: 504 });
    }
    if (res.status === 429) {
      // Propagate the rate-limit + Retry-After — the client already backs off on it.
      return Response.json(
        { error: "yupoo rate limited" },
        { status: 429, headers: { "Retry-After": res.headers.get("Retry-After") ?? "5" } },
      );
    }
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
      { photos, links, description, title: extractTitle(html) },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

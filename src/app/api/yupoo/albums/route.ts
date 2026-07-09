import { isValidYupooHost, type YupooAlbum } from "@/lib/yupoo";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Yupoo's gallery tab paginates at 120 albums per page. */
const PAGE_SIZE = 120;

const LIMIT = 60;
const WINDOW_MS = 60_000;

function decodeEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * Parse a Yupoo album listing. Yupoo stores use several theme layouts
 * (album1, category, category_commerce, …) with different card classes, so
 * this walks every <a> that links to /albums/{id} and carries a title —
 * verified against all three layout families on live stores. Covers hide in
 * src / data-src / data-origin-src depending on theme (some themes put a
 * base64 placeholder pixel in src and the real URL in data-origin-src).
 */
function parseAlbums(html: string): YupooAlbum[] {
  const albums: YupooAlbum[] = [];
  const seen = new Set<string>();
  for (const part of html.split(/<a\s/).slice(1)) {
    const end = part.indexOf("</a>");
    const block = end === -1 ? part.slice(0, 3000) : part.slice(0, end);
    const openEnd = block.indexOf(">");
    if (openEnd === -1) continue;
    const openTag = block.slice(0, openEnd);
    const id = openTag.match(/href="\/albums\/(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    const title = openTag.match(/title="([^"]*)"/)?.[1];
    if (title === undefined) continue;
    seen.add(id);
    const cover =
      block.match(/(?:data-origin-src|data-src|src)="((?:https?:)?\/\/photo\.yupoo\.com[^"]+)"/)?.[1] ?? null;
    const count = Number(block.match(/photonumber[^>]*>[^0-9<]*(\d+)/)?.[1] ?? 0);
    albums.push({
      id,
      title: decodeEntities(title),
      count,
      cover: cover ? (cover.startsWith("//") ? `https:${cover}` : cover) : null,
    });
  }
  return albums;
}

export async function GET(request: Request) {
  const rl = rateLimit(`yupoo-albums:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl, "Too many requests — try again shortly.");

  const params = new URL(request.url).searchParams;
  const host = params.get("host") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  if (!isValidYupooHost(host)) {
    return Response.json({ error: "invalid host" }, { status: 400 });
  }

  try {
    // tab=gallery forces the flat all-albums listing on every store theme —
    // the default view on category/commerce themes only shows a per-collection
    // subset.
    const res = await fetch(`https://${host}.x.yupoo.com/albums?tab=gallery&page=${page}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      return Response.json({ error: `yupoo responded ${res.status}` }, { status: 502 });
    }
    const albums = parseAlbums(await res.text());
    return Response.json(
      { albums, hasMore: albums.length >= PAGE_SIZE },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

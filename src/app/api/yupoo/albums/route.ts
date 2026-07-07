import { isValidYupooHost, type YupooAlbum } from "@/lib/yupoo";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * Scrape a Yupoo store's album listing. Card markup (verified against live
 * stores): <a class="album__main" title="…" href="/albums/{id}?uid=1">
 * with an <img class="album__img" src="https://photo.yupoo.com/…"> cover and
 * a "[N张]" photo count.
 */
function parseAlbums(html: string): YupooAlbum[] {
  const albums: YupooAlbum[] = [];
  const chunks = html.split('class="album__main').slice(1);
  for (const raw of chunks) {
    const chunk = raw.slice(0, raw.indexOf("</a>") + 4 || undefined);
    const id = chunk.match(/href="\/albums\/(\d+)/)?.[1];
    const title = chunk.match(/title="([^"]*)"/)?.[1];
    if (!id || !title) continue;
    const cover = chunk.match(/(?:data-src|src)="((?:https?:)?\/\/photo\.yupoo\.com[^"]+)"/)?.[1] ?? null;
    const count = Number(chunk.match(/\[(\d+)/)?.[1] ?? 0);
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
  const params = new URL(request.url).searchParams;
  const host = params.get("host") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  if (!isValidYupooHost(host)) {
    return Response.json({ error: "invalid host" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://${host}.x.yupoo.com/albums?page=${page}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      return Response.json({ error: `yupoo responded ${res.status}` }, { status: 502 });
    }
    const albums = parseAlbums(await res.text());
    return Response.json(
      { albums, hasMore: albums.length >= 30 },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

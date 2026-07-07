import { isValidYupooHost } from "@/lib/yupoo";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Scrape the photo list of one Yupoo album. Photos are lazy-loaded
 * <img data-src="https://photo.yupoo.com/{user}/{hash}/big.jpg"> tags.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const host = params.get("host") ?? "";
  const id = params.get("id") ?? "";
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
    const photos: string[] = [];
    const seen = new Set<string>();
    for (const m of html.matchAll(/data-src="((?:https?:)?\/\/photo\.yupoo\.com[^"]+)"/g)) {
      const url = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
      if (!seen.has(url)) {
        seen.add(url);
        photos.push(url);
      }
    }
    return Response.json({ photos }, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

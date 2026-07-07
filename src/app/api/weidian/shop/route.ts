export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Live Weidian shop preview: name and logo scraped from the shop page shell
 * (the item grid is a JS app behind private APIs, but the <title> and the
 * logo <meta> are server-rendered — verified against live shops).
 */
export async function GET(request: Request) {
  const userid = new URL(request.url).searchParams.get("userid") ?? "";
  if (!/^\d{1,20}$/.test(userid)) {
    return Response.json({ error: "invalid userid" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://weidian.com/?userid=${userid}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json({ error: `weidian responded ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const name = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? null;
    const logo =
      html.match(/<meta\s+name="logo"\s+content="(https?:\/\/[^"]+)"/)?.[1] ?? null;

    // A missing or generic title means the shop shell didn't load properly.
    if (!name || name === "微店") {
      return Response.json({ error: "no shop data" }, { status: 404 });
    }
    return Response.json(
      { name, logo },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { canonicalUrl, type Marketplace } from "@/lib/links";
import { extractPreview } from "@/lib/marketplacePreview";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const LIMIT = 30;
const WINDOW_MS = 60_000;

const MARKETPLACES: Marketplace[] = ["taobao", "weidian", "1688", "xianyu"];

/**
 * Best-effort product preview for a pasted marketplace item link: fetch the
 * item page's HTML shell and scrape og/meta + a price out of it (see
 * lib/marketplacePreview). Weidian shells scrape reliably; Taobao/1688 are
 * login/anti-bot walled and often return only a title/nulls — that's expected
 * and handled by the client. No API key, no marketplace API — just the public
 * HTML, same approach as /api/weidian/shop.
 */
export async function GET(request: Request) {
  const rl = rateLimit(`marketplace-preview:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl, "Too many requests — try again shortly.");

  const params = new URL(request.url).searchParams;
  const marketplace = params.get("marketplace") as Marketplace | null;
  const itemId = params.get("itemId") ?? "";
  if (!marketplace || !MARKETPLACES.includes(marketplace)) {
    return Response.json({ error: "invalid marketplace" }, { status: 400 });
  }
  if (!/^\d{1,20}$/.test(itemId)) {
    return Response.json({ error: "invalid itemId" }, { status: 400 });
  }

  const target = canonicalUrl(marketplace, itemId);
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json({ error: `marketplace responded ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const preview = extractPreview(html, marketplace);
    return Response.json(preview, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}

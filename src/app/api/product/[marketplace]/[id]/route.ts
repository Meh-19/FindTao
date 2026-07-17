import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import type { Marketplace } from "@/lib/links";
import { sanitizeProductDetails, upstreamMarketplace } from "@/lib/productDetails";

const UPSTREAM = "https://www.jadeship.com/api/public/v2/metered/item";

/**
 * The cheapest field set that still carries what the app shows. `description`,
 * `descriptionImgUrls` and `props` are surcharged upstream, so they're left out
 * until something actually needs them.
 */
const FIELDS = "id,title,price,thumbnailUrl,imgUrls,shipping,sales";

/**
 * A product's facts barely change, and every miss costs real money — so this is
 * cached hard. The framework's fetch cache is shared across all visitors of a
 * deployment, so a given item is paid for roughly once a day in total, not once
 * per shopper. The client caches on top of that.
 */
const REVALIDATE_S = 24 * 3600;

const MARKETPLACES: Marketplace[] = ["taobao", "weidian", "1688", "xianyu"];

// Generous for a human opening albums, and a backstop against someone driving
// the metered upstream through this route. Cached hits don't reach upstream at all.
const LIMIT = 60;
const WINDOW_MS = 60_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ marketplace: string; id: string }> },
) {
  const rl = rateLimit(`product:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl, "Too many product lookups — try again shortly.");

  const { marketplace: rawMarketplace, id } = await params;
  const marketplace = rawMarketplace as Marketplace;
  if (!MARKETPLACES.includes(marketplace)) {
    return Response.json({ error: "bad_request", message: "Unknown marketplace" }, { status: 400 });
  }
  if (!/^\d{1,20}$/.test(id)) {
    return Response.json({ error: "bad_request", message: "Invalid item id" }, { status: 400 });
  }

  const upstream = upstreamMarketplace(marketplace);
  if (!upstream) {
    return Response.json(
      { error: "unsupported_marketplace", message: `Product data isn't available for ${marketplace} items` },
      { status: 501 },
    );
  }

  const apiKey = process.env.JADESHIP_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "not_configured", message: "Product data isn't set up — add JADESHIP_API_KEY to enable it." },
      { status: 501 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${UPSTREAM}/${upstream}/${id}?fields=${FIELDS}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      next: { revalidate: REVALIDATE_S },
    });
  } catch {
    return Response.json({ error: "upstream_unreachable", message: "Couldn't reach the product service" }, { status: 502 });
  }

  if (!res.ok) {
    // 402 means the account is out of credit — that's an operator problem, and
    // saying so beats a generic failure when the feature silently stops working.
    const message =
      res.status === 401
        ? "The product API key is invalid — check JADESHIP_API_KEY"
        : res.status === 402
          ? "The product API account is out of credit"
          : res.status === 404
            ? "That item no longer exists on the marketplace"
            : "The product service returned an error";
    const status = res.status === 404 ? 404 : res.status === 401 || res.status === 402 ? 501 : 502;
    return Response.json({ error: "upstream_error", message }, { status });
  }

  const details = sanitizeProductDetails(await res.json().catch(() => null), marketplace, id);
  if (!details) {
    return Response.json({ error: "unreadable", message: "Couldn't read that item's details" }, { status: 502 });
  }

  return Response.json(details, {
    headers: { "Cache-Control": `public, max-age=${REVALIDATE_S}` },
  });
}

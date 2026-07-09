import { isValidYupooHost } from "@/lib/yupoo";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// A single album grid can legitimately fire dozens of these at once
// (one per thumbnail), so the ceiling is high — this is just a backstop
// against someone using it as a general-purpose image proxy.
const LIMIT = 300;
const WINDOW_MS = 60_000;

/**
 * Image proxy for photo.yupoo.com, which hotlink-blocks anything without a
 * Referer from the owning store. Locked to that host only — this is not a
 * general-purpose proxy.
 */
export async function GET(request: Request) {
  const rl = rateLimit(`yupoo-img:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });

  const params = new URL(request.url).searchParams;
  const host = params.get("host") ?? "";
  const u = params.get("u") ?? "";
  if (!isValidYupooHost(host)) {
    return new Response("invalid host", { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== "photo.yupoo.com") {
    return new Response("forbidden target", { status: 400 });
  }

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": UA, Referer: `https://${host}.x.yupoo.com/` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return new Response("upstream error", { status: 502 });
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}

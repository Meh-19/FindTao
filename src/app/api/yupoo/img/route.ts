import { isValidYupooHost } from "@/lib/yupoo";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Image proxy for photo.yupoo.com, which hotlink-blocks anything without a
 * Referer from the owning store. Locked to that host only — this is not a
 * general-purpose proxy.
 */
export async function GET(request: Request) {
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

/**
 * Server-side image fetching for the share images (next/og). Satori can't fetch
 * Yupoo's hotlink-protected photos itself, and routing through our own public
 * /api/yupoo/img proxy means the container fetches its own hostname — an
 * unreliable loopback on some hosts (Railway). So we fetch photo.yupoo.com
 * DIRECTLY with the same Referer spoof the proxy uses, and inline the bytes as a
 * data URL. A per-image failure just yields null (the caller draws a gradient).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function inlineYupooImage(image: string, host: string): Promise<string | null> {
  try {
    const url = image.startsWith("//") ? `https:${image}` : image;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: `https://${host}.x.yupoo.com/` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Map with bounded concurrency, so a big share doesn't fire dozens of Yupoo fetches at once. */
export async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

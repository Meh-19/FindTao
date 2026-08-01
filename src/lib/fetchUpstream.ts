/**
 * Resilient fetch for the scraping proxy's upstreams (Yupoo, Weidian). This is
 * the app's most fragile dependency, so every upstream call goes through here:
 *
 *  - Hard timeout via AbortSignal.timeout, so a hung upstream fails fast instead
 *    of tying up the serverless function until the platform kills it.
 *  - One retry on a transient failure (network error, timeout, or 5xx) — a
 *    one-off blip shouldn't surface as a dead store.
 *  - No retry on 4xx (including 429): those are deliberate upstream answers, and
 *    hammering a rate-limit only digs the hole deeper. Callers propagate 429.
 *
 * Returns null only when every attempt failed to get *any* response (network
 * error / timeout); otherwise the Response is returned as-is for the caller to
 * inspect (.ok, .status, 429, …).
 */
const DEFAULT_TIMEOUT_MS = 9000;

export async function fetchUpstream(
  url: string | URL,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      // Retry a transient upstream 5xx; return everything else (2xx/3xx/4xx) as-is.
      if (res.status >= 500 && attempt < retries) continue;
      return res;
    } catch {
      // Network error or timeout — retry if we have attempts left, else give up.
      if (attempt >= retries) return null;
    }
  }
  return null;
}

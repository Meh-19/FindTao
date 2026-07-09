/**
 * In-memory, per-process rate limiter. The app runs as a single persistent
 * Node server (Railway/Docker — see Dockerfile's `node server.js`, not
 * edge/serverless), so module-level state survives across requests within
 * that process. This won't share state across horizontally-scaled replicas
 * — if this ever runs multi-instance, swap the Map for Redis/Upstash — but
 * it's a real, zero-infra backstop against the two things worth guarding
 * right now: someone hammering the paid AI Advisor endpoint, and someone
 * hammering the Yupoo/Weidian scraping proxies.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep expired buckets periodically so long-lived deployments don't
// accumulate one entry per distinct visitor forever. unref() so this timer
// never keeps the process alive on its own.
const sweeper = setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60_000,
);
sweeper.unref?.();

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window (0 once blocked). */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
}

/**
 * Fixed-window limiter: `limit` requests per `windowMs` per `key`.
 * Simple on purpose — good enough to blunt abuse/runaway costs without
 * needing external infra.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Best-effort caller identity from standard proxy headers (Railway, like
 * most PaaS, sits behind a reverse proxy that sets these). Falls back to a
 * shared bucket when neither is present — still limits worst-case
 * same-origin abuse, just not per-visitor.
 */
export function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Standard 429 response with a Retry-After header, ready to `return` from a route handler. */
export function rateLimitResponse(result: RateLimitResult, message: string): Response {
  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return Response.json(
    { error: "rate_limited", message },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

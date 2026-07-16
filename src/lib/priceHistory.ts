/**
 * Price history per item id (`album:{host}:{yupooId}`), so the app can say
 * "this dropped ¥45 since you saved it" instead of only ever knowing today's
 * number.
 *
 * This deliberately does NOT live in `clientCache` — that store is TTL'd and
 * evicts oldest-first, which is exactly wrong for history. It's a single small
 * blob under its own key, holding only *changes*: a price that scrapes the same
 * value twice adds nothing, so a watched item costs a handful of bytes a month.
 *
 * Best-effort like the rest of the local layer: any storage error is swallowed.
 */

const KEY = "findtao:pricehist";
/** Items tracked before oldest-touched eviction. */
const MAX_ITEMS = 400;
/** Price changes kept per item — enough to draw a trend, cheap to store. */
const MAX_POINTS = 8;

export interface PricePoint {
  /** When the price was observed. */
  at: number;
  cny: number;
}

/** Newest-last list of *distinct* observed prices, keyed by item id. */
type History = Record<string, PricePoint[]>;

function readAll(): History {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as History) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(h: History): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* quota or storage disabled — history is a nicety, never a hard failure */
  }
}

/** Drop the least-recently-updated items once the blob outgrows MAX_ITEMS. */
function evict(h: History): History {
  const ids = Object.keys(h);
  if (ids.length <= MAX_ITEMS) return h;
  const lastSeen = (id: string) => h[id][h[id].length - 1]?.at ?? 0;
  const keep = ids.sort((a, b) => lastSeen(b) - lastSeen(a)).slice(0, MAX_ITEMS);
  const next: History = {};
  for (const id of keep) next[id] = h[id];
  return next;
}

/**
 * Record an observed price. A repeat of the current price is ignored, so the
 * series only ever holds real changes — callers can fire this on every scrape.
 */
export function recordPrice(id: string, cny: number, at = Date.now()): void {
  if (!Number.isFinite(cny) || cny <= 0) return;
  const all = readAll();
  const points = all[id] ?? [];
  if (points[points.length - 1]?.cny === cny) return;
  all[id] = [...points, { at, cny }].slice(-MAX_POINTS);
  writeAll(evict(all));
}

export function getHistory(id: string): PricePoint[] {
  return readAll()[id] ?? [];
}

/** The most recent price we've observed for an item, or null if never seen. */
export function latestPrice(id: string): PricePoint | null {
  const points = getHistory(id);
  return points[points.length - 1] ?? null;
}

export interface PriceChange {
  /** What it cost before (the baseline the caller passed in). */
  from: number;
  /** What it costs now. */
  to: number;
  /** Negative for a drop, positive for a rise. */
  deltaCny: number;
  /** Signed percentage, rounded — -15 means 15% cheaper. */
  deltaPct: number;
  at: number;
}

/** Ignore sub-1% wobble so rounding noise never renders as a "drop". */
const MIN_PCT = 1;

/**
 * Compare a baseline price (what the shopper saved the item at) against the
 * newest observation. Returns null when nothing meaningful moved.
 */
export function priceChangeSince(id: string, baselineCny: number | null): PriceChange | null {
  if (baselineCny == null || baselineCny <= 0) return null;
  const latest = latestPrice(id);
  if (!latest || latest.cny === baselineCny) return null;
  const deltaCny = latest.cny - baselineCny;
  const deltaPct = Math.round((deltaCny / baselineCny) * 100);
  if (Math.abs(deltaPct) < MIN_PCT) return null;
  return { from: baselineCny, to: latest.cny, deltaCny, deltaPct, at: latest.at };
}

/**
 * Batch form of `priceChangeSince` for a list of saved lines — each compared
 * against the price it was saved at. Parses the blob once.
 */
export function priceChangesSince(
  entries: { id: string; priceCny: number | null }[],
): Record<string, PriceChange | null> {
  const all = readAll();
  const out: Record<string, PriceChange | null> = {};
  for (const { id, priceCny } of entries) {
    const points = all[id];
    const latest = points?.[points.length - 1];
    if (!latest || priceCny == null || priceCny <= 0 || latest.cny === priceCny) {
      out[id] = null;
      continue;
    }
    const deltaCny = latest.cny - priceCny;
    const deltaPct = Math.round((deltaCny / priceCny) * 100);
    out[id] = Math.abs(deltaPct) < MIN_PCT ? null : { from: priceCny, to: latest.cny, deltaCny, deltaPct, at: latest.at };
  }
  return out;
}

/**
 * Scale a per-unit move to a line's quantity, so the delta reconciles with the
 * qty-multiplied total it's rendered next to (a ×2 line that rose ¥30 a piece
 * costs ¥60 more, not ¥30). The percentage is unchanged by quantity.
 */
export function scaleChange(change: PriceChange | null, qty: number): PriceChange | null {
  if (!change || qty <= 1) return change;
  return { ...change, from: change.from * qty, to: change.to * qty, deltaCny: change.deltaCny * qty };
}

/** The move within a series: second-newest price vs the newest one. */
function changeIn(points: PricePoint[] | undefined): PriceChange | null {
  if (!points || points.length < 2) return null;
  const prev = points[points.length - 2];
  const latest = points[points.length - 1];
  const deltaCny = latest.cny - prev.cny;
  const deltaPct = Math.round((deltaCny / prev.cny) * 100);
  if (Math.abs(deltaPct) < MIN_PCT) return null;
  return { from: prev.cny, to: latest.cny, deltaCny, deltaPct, at: latest.at };
}

/** The item's own most recent move — previous observed price vs the newest one. */
export function lastPriceChange(id: string): PriceChange | null {
  return changeIn(getHistory(id));
}

/**
 * Batch form of `lastPriceChange`. A store grid asks about ~120 albums per
 * render; this parses the blob once instead of once per id.
 */
export function lastPriceChanges(ids: string[]): Record<string, PriceChange | null> {
  const all = readAll();
  const out: Record<string, PriceChange | null> = {};
  for (const id of ids) out[id] = changeIn(all[id]);
  return out;
}

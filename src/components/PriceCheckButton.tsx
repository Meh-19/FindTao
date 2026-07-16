"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchAlbumPriceFresh } from "@/lib/albumPrice";
import { priceChangesSince } from "@/lib/priceHistory";
import { useStore, type SavedItem } from "@/lib/store";

/** Album lines carry their host + id in the cart id — that's all a re-scrape needs. */
function albumTarget(item: SavedItem): { host: string; yupooId: string } | null {
  const m = item.id.match(/^album:([a-z0-9-]+):(\d+)$/i);
  return m ? { host: m[1], yupooId: m[2] } : null;
}

const CONCURRENCY = 4;

/**
 * Re-scrapes the live price of every Yupoo album line in `items` and reports
 * what moved since the shopper saved it. Deliberately manual: this is the one
 * path that ignores the price cache, so it stays a button rather than
 * something that fires on every page view.
 */
export function PriceCheckButton({
  items,
  onChecked,
  className = "",
}: {
  items: SavedItem[];
  /** Fired after the history is written, so the caller can recompute its badges. */
  onChecked?: () => void;
  className?: string;
}) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);

  const targets = items
    .map((item) => ({ item, target: albumTarget(item) }))
    .filter((t): t is { item: SavedItem; target: { host: string; yupooId: string } } => t.target !== null);

  if (targets.length === 0) return null;

  async function run() {
    setBusy(true);
    try {
      let cursor = 0;
      async function worker() {
        while (cursor < targets.length) {
          const { item, target } = targets[cursor++];
          await fetchAlbumPriceFresh(target.host, target.yupooId, { fallbackText: item.title });
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()),
      );

      const moves = priceChangesSince(targets.map(({ item }) => ({ id: item.id, priceCny: item.priceCny })));
      const changed = Object.values(moves).filter((m) => m !== null);
      const drops = changed.filter((m) => m!.deltaCny < 0).length;
      const rises = changed.length - drops;

      if (changed.length === 0) {
        toast(`Checked ${targets.length} item${targets.length === 1 ? "" : "s"} — no price changes`, "info");
      } else {
        const parts = [drops > 0 && `${drops} dropped`, rises > 0 && `${rises} went up`].filter(Boolean);
        toast(parts.join(", "), drops > 0 ? "success" : "info");
      }
      onChecked?.();
    } catch {
      toast("Couldn't check prices — try again", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className={`flex items-center gap-1.5 text-xs text-mist-500 transition-colors hover:text-neon-300 disabled:cursor-wait disabled:text-mist-500 ${className}`}
    >
      <RefreshCw size={12} aria-hidden="true" className={busy ? "animate-spin" : ""} />
      {busy ? `Checking ${targets.length}…` : "Check prices"}
    </button>
  );
}

"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import type { PriceChange } from "@/lib/priceHistory";

function ago(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * A price move, rendered green for a drop and amber for a rise. `change` comes
 * from priceHistory — pass null and nothing renders, so call sites stay flat.
 */
export function PriceDropBadge({
  change,
  className = "",
}: {
  change: PriceChange | null;
  className?: string;
}) {
  if (!change) return null;
  const dropped = change.deltaCny < 0;
  const Icon = dropped ? TrendingDown : TrendingUp;

  return (
    <span
      title={`${formatMoney(change.from, "CNY")} → ${formatMoney(change.to, "CNY")}, seen ${ago(change.at)}`}
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        dropped ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"
      } ${className}`}
    >
      <Icon size={11} aria-hidden="true" />
      {dropped ? "−" : "+"}
      {formatMoney(Math.abs(change.deltaCny), "CNY")}
      <span className="font-normal opacity-70">({Math.abs(change.deltaPct)}%)</span>
    </span>
  );
}

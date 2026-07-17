"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Store, TrendingDown } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { otherSellers } from "@/lib/productIndex";
import type { ParsedLink } from "@/lib/links";
import { productKey } from "@/lib/links";
import { useStore } from "@/lib/store";

/**
 * Other Yupoo stores fronting the identical marketplace item, cheapest first.
 *
 * The saving is the whole point, so it leads with it — but only over stores the
 * shopper has actually browsed (that's when descriptions get scraped), which
 * the footer says plainly rather than implying a whole-market search.
 */
export function OtherSellers({
  link,
  storeId,
  thisPriceCny,
  onNavigate,
}: {
  link: ParsedLink;
  /** The store being viewed — excluded, so its own colourways aren't offered as rivals. */
  storeId: string;
  /** What this seller is asking, for the "you'd save X" line. */
  thisPriceCny: number | null;
  onNavigate?: () => void;
}) {
  const { fmtConverted } = useStore();
  const sellers = useMemo(() => otherSellers(productKey(link), { storeId }), [link, storeId]);

  if (sellers.length === 0) return null;

  const cheapest = sellers.find((s) => s.priceCny !== null);
  const saving =
    cheapest?.priceCny != null && thisPriceCny != null && cheapest.priceCny < thisPriceCny
      ? thisPriceCny - cheapest.priceCny
      : null;

  return (
    <div className="border-t border-white/5 pt-2.5">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-mist-400">
        <Store size={11} aria-hidden="true" />
        Same item at {sellers.length} other store{sellers.length === 1 ? "" : "s"}
        {saving !== null && (
          <span className="flex items-center gap-1 border border-success/40 bg-success/10 px-1.5 py-0.5 font-bold uppercase tracking-wide text-success">
            <TrendingDown size={10} aria-hidden="true" />
            save {formatMoney(saving, "CNY")}
          </span>
        )}
      </p>
      <div className="space-y-1">
        {sellers.slice(0, 4).map((s) => (
          <Link
            key={`${s.host}:${s.yupooId}`}
            href={`/store/${s.storeId}?album=${s.yupooId}`}
            onClick={onNavigate}
            className="flex items-center gap-2 border border-white/5 bg-ink-800/60 px-2.5 py-1.5 text-xs transition-colors hover:border-white"
          >
            <span className="min-w-0 flex-1 truncate text-mist-300" title={s.title}>
              {s.storeName}
              <span className="ml-1.5 text-mist-500">{s.title}</span>
            </span>
            {s.priceCny !== null ? (
              <span className="shrink-0 tabular-nums font-semibold text-mist-100">
                {formatMoney(s.priceCny, "CNY")}{" "}
                <span className="flow-text font-bold">≈ {fmtConverted(s.priceCny)}</span>
              </span>
            ) : (
              <span className="shrink-0 text-mist-500">no price</span>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-mist-500">
        From stores you&apos;ve browsed — open more of your library to widen the comparison.
      </p>
    </div>
  );
}

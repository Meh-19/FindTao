"use client";

import { useEffect, useState } from "react";
import { Boxes, Loader2, Scale, TrendingUp } from "lucide-react";
import type { ParsedLink } from "@/lib/links";
import {
  fetchProductDetails,
  formatVolume,
  supportsProductDetails,
  type ProductDetails,
} from "@/lib/productDetails";
import { formatMoney } from "@/lib/currency";
import { useStore } from "@/lib/store";

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-white/5 bg-ink-800/60 px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mist-500">
        {icon}
        {label}
      </p>
      <p className="text-xs font-semibold tabular-nums text-mist-100">{value}</p>
    </div>
  );
}

/**
 * The seller's real listing facts, from the marketplace rather than the album.
 *
 * Every lookup is metered, so this only runs for an album a shopper opened, and
 * the answer is cached for a day on both sides. When it isn't configured it
 * renders nothing at all — an unconfigured deployment should look like this
 * feature doesn't exist, not like it's broken.
 */
export function ProductFacts({ link, albumPriceCny }: { link: ParsedLink; albumPriceCny: number | null }) {
  const { fmtConverted } = useStore();
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supportsProductDetails(link.marketplace)) return;
    let cancelled = false;
    setDetails(null);
    setLoading(true);
    fetchProductDetails(link).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setDetails(r.details);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 border-t border-white/5 pt-2.5 text-[11px] text-mist-500">
        <Loader2 size={11} aria-hidden="true" className="animate-spin" />
        Reading the seller&apos;s listing…
      </p>
    );
  }
  if (!details) return null;

  const { weight, volume, domesticFreight } = details.shipping;
  const facts = [
    weight != null && (
      <Fact key="w" icon={<Scale size={9} aria-hidden="true" />} label="Weight" value={`${weight} g`} />
    ),
    volume != null && (
      <Fact key="v" icon={<Boxes size={9} aria-hidden="true" />} label="Packed" value={formatVolume(volume)} />
    ),
    details.sales != null && (
      <Fact key="s" icon={<TrendingUp size={9} aria-hidden="true" />} label="Sold" value={details.sales.toLocaleString()} />
    ),
  ].filter(Boolean);

  // The album's price is the seller's Yupoo markup; this is the listing itself.
  // Worth flagging when they disagree — that gap is the middleman's cut.
  const gap =
    details.priceCny != null && albumPriceCny != null && Math.abs(details.priceCny - albumPriceCny) >= 1
      ? details.priceCny - albumPriceCny
      : null;

  return (
    <div className="space-y-1.5 border-t border-white/5 pt-2.5">
      {details.title && (
        <p className="line-clamp-1 text-[11px] text-mist-400" title={details.title}>
          <span className="text-mist-500">Listing:</span> {details.title}
        </p>
      )}

      {details.priceCny != null && (
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-mist-400">
          <span className="text-mist-500">Marketplace price:</span>
          <span className="font-semibold tabular-nums text-mist-100">
            {formatMoney(details.priceCny, "CNY")}
          </span>
          <span className="flow-text font-bold">≈ {fmtConverted(details.priceCny)}</span>
          {gap !== null && (
            <span
              title={
                gap > 0
                  ? "The listing costs more than this album says — the album price may be stale."
                  : "This album is priced above the marketplace listing."
              }
              className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                gap > 0 ? "border-warning/40 bg-warning/10 text-warning" : "border-mist-300/30 bg-mist-100/5 text-mist-300"
              }`}
            >
              album says {formatMoney(albumPriceCny!, "CNY")}
            </span>
          )}
        </p>
      )}

      {facts.length > 0 && <div className="grid grid-cols-3 gap-1.5">{facts}</div>}

      {domesticFreight != null && (
        <p className="text-[10px] text-mist-500">
          Seller charges {formatMoney(domesticFreight, "CNY")} to ship to your agent&apos;s warehouse.
        </p>
      )}
    </div>
  );
}

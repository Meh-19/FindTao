"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImageOff, Loader2, Store, X } from "lucide-react";
import type { ParsedLink } from "@/lib/links";
import type { MarketplacePreview } from "@/lib/marketplacePreview";
import { formatMoney } from "@/lib/currency";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { MARKETPLACE_LABEL } from "@/lib/marketplaceLabel";
import { AgentActions } from "./AgentActions";

/**
 * "Reads the data like an agent does" for a pasted marketplace item link:
 * scrapes a best-effort product preview (title/image/price via
 * /api/marketplace/preview), shows agent buy buttons, and a View store
 * hand-off. Weidian resolves into an in-app store view; the other, login-walled
 * marketplaces hand off externally.
 */
export function LinkPreview({ link, onClose }: { link: ParsedLink; onClose: () => void }) {
  const { allStores, submitStore, fmtConverted, toast } = useStore();
  const router = useRouter();
  const containerRef = useModalA11y<HTMLDivElement>(true);
  const [data, setData] = useState<MarketplacePreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/marketplace/preview?marketplace=${link.marketplace}&itemId=${link.itemId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: MarketplacePreview) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [link.marketplace, link.itemId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = MARKETPLACE_LABEL[link.marketplace];

  function viewStore() {
    // Weidian: resolve (or create) an in-app store keyed by seller id, then
    // land on its store view (live name/logo + inventory hand-off).
    if (link.marketplace === "weidian" && data?.sellerUserId) {
      const uid = data.sellerUserId;
      const existing = allStores.find(
        (s) => s.id === `weidian-${uid}` || s.url.includes(`userid=${uid}`),
      );
      if (existing) {
        onClose();
        router.push(`/store/${existing.id}`);
        return;
      }
      const id = `weidian-${uid}`;
      const name = (data.title?.trim() || `Weidian ${uid}`).slice(0, 60);
      submitStore({
        id,
        name,
        url: `https://weidian.com/?userid=${uid}`,
        categories: ["Clothing"],
        hue: ["#8b5cf6", "#22d3ee"],
        trust: 50,
        blurb: "",
        albums: 0,
        community: false,
        image: data.image ?? null,
      });
      toast(`Added ${name} to your library`);
      onClose();
      router.push(`/store/${id}`);
      return;
    }
    // Taobao/1688/Xianyu are login-walled — hand off to the shop or the item.
    window.open(data?.sellerShopUrl ?? link.rawUrl, "_blank", "noopener,noreferrer");
  }

  const canViewStoreInApp = link.marketplace === "weidian" && !!data?.sellerUserId;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} item preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fade-up w-full max-w-md overflow-hidden rounded-none border border-white/10 bg-ink-900 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flow-bg h-0.5" />
        <div className="flex items-center justify-between px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mist-400">
            {label} · item {link.itemId}
          </p>
          <button onClick={onClose} aria-label="Close preview" className="rounded px-2 py-1 text-mist-400 hover:text-white">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex flex-col items-center gap-2 border border-dashed border-ink-500 py-12 text-sm text-mist-400">
              <Loader2 size={18} aria-hidden="true" className="animate-spin" /> Reading the listing…
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                {data?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.image}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-none border border-white/10 object-cover"
                  />
                ) : (
                  <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-none border border-white/10 bg-ink-800 text-mist-500">
                    <ImageOff size={20} aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-sm font-medium leading-snug text-mist-100">
                    {data?.title || "Couldn't read the product title — the link still works below."}
                  </p>
                  {data?.priceCny != null ? (
                    <p className="mt-1.5 text-sm font-semibold tabular-nums text-mist-100">
                      {formatMoney(data.priceCny, "CNY")}
                      {data.priceEstimate && (
                        <span className="ml-1 font-mono text-[9px] font-normal uppercase text-mist-500">¥ (est.)</span>
                      )}{" "}
                      <span className="flow-text text-xs font-bold">≈ {fmtConverted(data.priceCny)}</span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-mist-500">No price read from the listing.</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <AgentActions link={link} />
              </div>

              <button
                onClick={viewStore}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-none border border-ink-500 px-4 py-2.5 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
              >
                {canViewStoreInApp ? <Store size={14} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
                View store
                {!canViewStoreInApp && <span className="text-[11px] text-mist-500">(opens on {label})</span>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

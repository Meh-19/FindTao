"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Heart } from "lucide-react";
import { itemStore } from "@/data/catalog";
import { ItemCard } from "@/components/ItemCard";
import { LinkPreview } from "@/components/LinkPreview";
import { parseLink } from "@/lib/links";
import type { Marketplace } from "@/lib/links";
import { useStore, type CardSize } from "@/lib/store";

const MARKETPLACES: { value: Marketplace | "all"; label: string }[] = [
  { value: "all", label: "All marketplaces" },
  { value: "taobao", label: "Taobao" },
  { value: "weidian", label: "Weidian" },
  { value: "1688", label: "1688" },
  { value: "xianyu", label: "Xianyu" },
];

const GRID: Record<CardSize, string> = {
  s: "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
  m: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  l: "grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
};

const inputClass =
  "rounded-none border border-ink-500 bg-ink-800/80 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

const chipClass =
  "flex cursor-pointer items-center gap-2 rounded-none border border-ink-500 px-3 py-1.5 transition-colors has-checked:border-neon-500/60 has-checked:bg-neon-600/15 has-checked:text-neon-300";

function SearchView() {
  const router = useRouter();
  const { prefs, wishlist, hydrated, catalogItems } = useStore();
  const [query, setQuery] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace | "all">("all");
  const [qcOnly, setQcOnly] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(300);

  const pastedLink = useMemo(() => parseLink(query), [query]);

  // Auto-open the product preview once per distinct pasted link (parseLink only
  // resolves on a complete link, so this fires when a full URL lands, not on
  // every keystroke). Closing it doesn't re-pop until a different link is typed.
  const [previewOpen, setPreviewOpen] = useState(false);
  const lastAutoKey = useRef<string | null>(null);
  useEffect(() => {
    if (!pastedLink) {
      lastAutoKey.current = null;
      return;
    }
    const key = `${pastedLink.marketplace}:${pastedLink.itemId}`;
    if (lastAutoKey.current !== key) {
      lastAutoKey.current = key;
      setPreviewOpen(true);
    }
  }, [pastedLink]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogItems.filter((item) => {
      const store = itemStore(item);
      if (marketplace !== "all" && item.marketplace !== marketplace) return false;
      if (qcOnly && item.qcCount === 0) return false;
      if (trustedOnly && store.trust < 85) return false;
      if (wishOnly && !wishlist.includes(item.id)) return false;
      if (item.priceCny > maxPrice) return false;
      if (!q) return true;
      const haystack = `${item.title} ${item.tags.join(" ")} ${store.name}`.toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [query, marketplace, qcOnly, trustedOnly, wishOnly, maxPrice, wishlist, catalogItems]);

  return (
    <div>
      <div className="fade-up mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Search <span className="flow-text">everything</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Cross-store search over your catalog — or paste any marketplace / agent link.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="varsity jacket, GAT, or paste a link…"
          className={`${inputClass} w-full sm:max-w-md`}
        />
        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value as Marketplace | "all")}
          className={inputClass}
        >
          {MARKETPLACES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {pastedLink && (
        <div className="fade-up mb-4 flex flex-wrap items-center gap-2 rounded-none border border-neon-500/40 bg-neon-600/15 px-4 py-3 text-sm text-neon-300">
          <span className="flex-1">That looks like a {pastedLink.marketplace} link.</span>
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 rounded-none border border-neon-500/50 px-3 py-1.5 font-semibold transition-colors hover:bg-neon-600/25"
          >
            <Eye size={13} aria-hidden="true" /> Preview
          </button>
          <button
            onClick={() => router.push(`/convert?link=${encodeURIComponent(query.trim())}`)}
            className="rounded-none px-3 py-1.5 font-medium underline decoration-neon-500/50 underline-offset-2 transition-colors hover:text-neon-200"
          >
            Open in converter →
          </button>
        </div>
      )}

      {pastedLink && previewOpen && (
        <LinkPreview link={pastedLink} onClose={() => setPreviewOpen(false)} />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-mist-300">
        <label className={chipClass}>
          <input type="checkbox" checked={qcOnly} onChange={(e) => setQcOnly(e.target.checked)} className="accent-white" />
          Has QC photos
        </label>
        <label className={chipClass}>
          <input type="checkbox" checked={trustedOnly} onChange={(e) => setTrustedOnly(e.target.checked)} className="accent-white" />
          Trusted sellers
        </label>
        <label className={chipClass}>
          <input type="checkbox" checked={wishOnly} onChange={(e) => setWishOnly(e.target.checked)} className="accent-white" />
          <Heart size={13} aria-hidden="true" className={wishOnly ? "fill-current" : ""} /> Wishlist only
        </label>
        <label className="flex items-center gap-2 rounded-none border border-ink-500 px-3 py-1.5">
          Max ¥
          <input
            type="range"
            min={30}
            max={300}
            step={10}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="accent-white"
          />
          <span className="w-8 font-semibold text-mist-100">{maxPrice}</span>
        </label>
        <span className="ml-auto text-mist-500">
          {results.length} item{results.length === 1 ? "" : "s"}
        </span>
      </div>

      {results.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          {catalogItems.length === 0
            ? "No finds in the catalog yet — paste a marketplace or agent link above to convert it, or browse stores from Discover while the catalog fills up."
            : "No matches. Loosen a filter, or paste a marketplace link to convert it directly."}
        </div>
      ) : (
        <div className={`grid ${GRID[prefs.cardSize]}`}>
          {results.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Link2, Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { Album } from "@/data/albums";
import type { StoreInfo } from "@/data/stores";
import { parseLink } from "@/lib/links";
import { parsePriceCnyDetailed } from "@/lib/price";
import { proxiedImg, type YupooPhotosResponse } from "@/lib/yupoo";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/clientCache";
import { useStore, duplicateNotice } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { formatMoney } from "@/lib/currency";
import { AgentActions } from "./AgentActions";
import { StoreAvatar } from "./StoreAvatar";
import { Lightbox } from "./Lightbox";

/**
 * Album browser — opens as a modal over the store view. Live Yupoo albums
 * fetch their real photos through the scraping API; placeholder albums fall
 * back to gradient tiles. Grid → full viewer with arrows/Esc.
 */
export function AlbumModal({
  store,
  album,
  host,
  onClose,
}: {
  store: StoreInfo;
  album: Album;
  /** Yupoo subdomain when this store's albums are live; null for placeholders. */
  host: string | null;
  onClose: () => void;
}) {
  const { addToCart, itemLocations, fmtConverted, toast, priceOverrides } = useStore();
  const [viewer, setViewer] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const live = Boolean(host && album.yupooId);
  // null = loading, [] = failed or empty (falls back to placeholder tiles)
  const [photos, setPhotos] = useState<string[] | null>(live ? null : []);
  const [itemLinks, setItemLinks] = useState<string[]>([]);
  // BUG FIX: the price almost never lives in the album title — sellers write
  // it as the first line of the album *description* instead (e.g.
  // "￥270\n\n13oz canvas work pants..."). The API now scrapes that
  // description; until it lands, fall back to the title so something shows.
  const [description, setDescription] = useState<string | null>(null);

  const parsedPrice = useMemo(
    () => parsePriceCnyDetailed(description ?? album.name),
    [description, album.name],
  );
  // A manual price set on the store tile (keyed by the album cart id) wins over the parsed one.
  const override = live ? priceOverrides[`album:${host}:${album.yupooId}`] : undefined;
  const priceCny = override ?? parsedPrice?.value ?? null;

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const cacheId = `${host}:${album.yupooId}`;

    // Paint instantly from the cached photo list, then revalidate (SWR).
    const cached = cacheGet<YupooPhotosResponse>("album", cacheId);
    if (cached) {
      setPhotos(cached.photos ?? []);
      setItemLinks(cached.links ?? []);
      setDescription(cached.description ?? null);
    }

    fetch(`/api/yupoo/album?host=${encodeURIComponent(host!)}&id=${album.yupooId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: YupooPhotosResponse) => {
        if (cancelled) return;
        setPhotos(data.photos ?? []);
        setItemLinks(data.links ?? []);
        setDescription(data.description ?? null);
        cacheSet<YupooPhotosResponse>(
          "album",
          cacheId,
          { photos: data.photos ?? [], links: data.links ?? [], description: data.description ?? null },
          CACHE_TTL.photos,
        );
      })
      .catch(() => {
        // Keep cached photos on a failed revalidation; only fall to empty if we had none.
        if (!cancelled && !cached) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [live, host, album.yupooId]);

  // Sellers often paste the item's marketplace link into the album
  // description — when one parses, offer the agent hand-off right here.
  const marketplaceLink = useMemo(() => {
    for (const raw of itemLinks) {
      const parsed = parseLink(raw);
      if (parsed) return parsed;
    }
    return null;
  }, [itemLinks]);

  const total = photos && photos.length > 0 ? photos.length : Math.max(album.photoCount, 1);
  const loading = photos === null;

  // UI FIX: the lightbox now owns its own Esc/arrow-key handling — this
  // modal only needs to close itself when the lightbox isn't open.
  useEffect(() => {
    if (viewer !== null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer, onClose]);

  // Scroll lock + focus trap/restore — deactivated while the nested photo
  // Lightbox is open so the two modals' Tab traps don't fight each other
  // (Lightbox takes over both while it's on top).
  const containerRef = useModalA11y<HTMLDivElement>(viewer === null);

  function tileStyle() {
    // Flat monochrome placeholder tile — no gradient, matches the hatch texture from .tile-shimmer.
    return { background: "#1a1a1a" };
  }

  const gridItems = loading
    ? Array.from({ length: Math.min(album.photoCount || 8, 12) }, () => null)
    : photos!.length > 0
      ? photos!
      : Array.from({ length: total }, () => null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${album.name} album`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fade-up flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-none border border-white/10 bg-ink-900 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flow-bg h-0.5 shrink-0" />
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <StoreAvatar store={store} className="h-8 w-8 rounded-none text-[10px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">{album.name}</p>
              <p className="text-[11px] text-mist-500">
                {store.name} · {loading ? "loading…" : `${total} photos`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close album"
            className="rounded-none p-1.5 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gridItems.map((photo, i) => (
              <button
                key={i}
                onClick={() => photo && setViewer(i)}
                disabled={!photo}
                aria-label={`Open photo ${i + 1}`}
                className="tile-shimmer aspect-square overflow-hidden rounded-none border border-white/5 transition-transform duration-200 enabled:hover:scale-[1.03] disabled:cursor-default"
                style={photo ? undefined : tileStyle()}
              >
                {photo && (
                  <img
                    src={proxiedImg(photo, host!)}
                    alt={`${album.name} photo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
          {!live && (
            <p className="mt-4 text-center text-[11px] text-mist-500">
              Placeholder tiles — live photos load for Yupoo stores.
            </p>
          )}
          {live && !loading && photos!.length === 0 && (
            <p className="mt-4 text-center text-[11px] text-mist-500">
              Couldn&apos;t load this album&apos;s photos — open the store on Yupoo instead.
            </p>
          )}
        </div>

        {live && (
          <div className="shrink-0 space-y-2.5 border-t border-white/5 px-5 py-3.5">
            {/* BUG FIX: on narrow viewports this row had no room to fit price +
                qty stepper + "Add to cart" on one line, so the button text
                wrapped into three lines and mangled the layout — stack it
                on small screens instead. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {priceCny !== null ? (
                  <p className="text-lg font-extrabold tabular-nums text-mist-100">
                    {formatMoney(priceCny, "CNY")}
                    {parsedPrice?.estimate && (
                      <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-wide text-mist-500">
                        ¥ (est.)
                      </span>
                    )}{" "}
                    <span className="flow-text text-sm font-bold">≈ {fmtConverted(priceCny)}</span>
                  </p>
                ) : (
                  <p className="text-sm text-mist-500">Price not listed — check with your agent</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-none border border-ink-500">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="px-2.5 py-2 text-mist-400 transition-colors hover:text-white"
                  >
                    <Minus size={13} aria-hidden="true" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-mist-100">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                    className="px-2.5 py-2 text-mist-400 transition-colors hover:text-white"
                  >
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const notice = duplicateNotice(itemLocations(`album:${host}:${album.yupooId}`));
                    addToCart(
                      {
                        id: `album:${host}:${album.yupooId}`,
                        title: album.name,
                        priceCny,
                        image: photos?.[0] ?? album.cover ?? null,
                        imgHost: host,
                        storeId: store.id,
                        storeName: store.name,
                        url: marketplaceLink?.rawUrl ?? null,
                      },
                      qty,
                    );
                    toast(notice ?? `Added ${qty} × ${album.name.slice(0, 40)} to cart`, notice ? "info" : "success");
                    setQty(1);
                  }}
                  className="btn-glow flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-none px-4 py-2 text-sm font-semibold text-white"
                >
                  <ShoppingCart size={14} aria-hidden="true" /> Add to cart
                </button>
              </div>
            </div>

            {marketplaceLink && (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <AgentActions link={marketplaceLink} dropUp />
                </div>
                <Link
                  href={`/convert?link=${encodeURIComponent(marketplaceLink.rawUrl)}`}
                  onClick={onClose}
                  aria-label="Open in converter"
                  className="rounded-none border border-ink-500 p-2.5 text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300"
                >
                  <Link2 size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* UI FIX: dedicated Lightbox — object-contain + max-h-[80vh], plus a
          dimensions/raw-link caption, instead of the old aspect-square
          viewer that could crop or stretch non-square photos. */}
      {viewer !== null && photos && (
        <Lightbox
          images={photos.map((p) => ({
            src: proxiedImg(p, host!),
            rawSrc: p,
            alt: `${album.name} photo`,
          }))}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          title={album.name}
        />
      )}
    </div>
  );
}

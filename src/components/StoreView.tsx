"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Images, Plus, ShoppingCart, Star } from "lucide-react";
import { storeItems } from "@/data/catalog";
import type { StoreInfo } from "@/data/stores";
import { storeAlbums, type Album } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { parsePriceCnyDetailed, type ParsedPrice } from "@/lib/price";
import { formatMoney } from "@/lib/currency";
import { proxiedImg, type YupooAlbumsResponse } from "@/lib/yupoo";
import { AlbumModal } from "./AlbumModal";
import { ItemCard } from "./ItemCard";
import { useStore } from "@/lib/store";

async function fetchAlbums(
  host: string,
  page: number,
  hue: [string, string],
): Promise<{ albums: Album[]; hasMore: boolean }> {
  const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(host)}&page=${page}`);
  if (!res.ok) throw new Error("albums fetch failed");
  const data = (await res.json()) as YupooAlbumsResponse;
  return {
    albums: (data.albums ?? []).map((a) => ({
      id: `yupoo-${a.id}`,
      yupooId: a.id,
      name: a.title,
      photoCount: a.count,
      cover: a.cover,
      hue,
    })),
    hasMore: data.hasMore ?? false,
  };
}

/** Real price lives in the album description, not the title (see AlbumModal) — fetch just that. */
async function fetchAlbumDescription(host: string, yupooId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/yupoo/album?host=${encodeURIComponent(host)}&id=${yupooId}&light=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as { description?: string | null };
    return data.description ?? null;
  } catch {
    return null;
  }
}

const PRICE_PREFETCH_CONCURRENCY = 6;

/**
 * Preview card for marketplace-hosted stores. Weidian shops get their live
 * name + logo (scraped server-side); Taobao is login-walled, so it stays a
 * clean hand-off card.
 */
function MarketplacePreview({
  store,
  label,
  weidianUserId,
}: {
  store: StoreInfo;
  label: string;
  weidianUserId?: string;
}) {
  const [shop, setShop] = useState<{ name: string; logo: string | null } | null>(null);

  useEffect(() => {
    if (!weidianUserId) return;
    let cancelled = false;
    fetch(`/api/weidian/shop?userid=${weidianUserId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { name: string; logo: string | null }) => {
        if (!cancelled && data.name) setShop(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weidianUserId]);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 rounded-none border border-white/5 bg-ink-800/60 p-5">
      {shop?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shop.logo}
          alt=""
          className="h-11 w-11 shrink-0 rounded-none border border-white/10 object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-mist-100">
          {shop ? (
            <>
              {shop.name} <span className="font-normal text-mist-500">· live on {label}</span>
            </>
          ) : (
            `${label} store`
          )}
        </p>
        <p className="mt-0.5 text-xs text-mist-500">
          Listings live on {label} — browse them there, then paste any item link into the
          converter to hand it to your agent.
        </p>
      </div>
      <a
        href={store.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white"
      >
        Visit on {label} <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}

export function StoreView({ id }: { id: string }) {
  const {
    allStores, inLibrary, addToLibrary, removeFromLibrary,
    favStores, toggleFavStore, toast, hydrated, tagDefs, fmtConverted, addToCart,
  } = useStore();
  const store = allStores.find((s) => s.id === id);
  const items = storeItems(id);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);

  const platform = useMemo(
    () => (store ? detectStorePlatform(store.url) : { platform: "other" as const, label: "Web" }),
    [store],
  );
  const yupooHost = platform.platform === "yupoo" ? (platform.yupooHost ?? null) : null;

  // Live Yupoo albums, paged. null = still loading the first page.
  const [liveAlbums, setLiveAlbums] = useState<Album[] | null>(yupooHost ? null : []);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);

  useEffect(() => {
    if (!yupooHost || !store) return;
    let cancelled = false;
    setLiveAlbums(null);
    setLiveFailed(false);
    setPage(1);
    fetchAlbums(yupooHost, 1, store.hue)
      .then(({ albums, hasMore }) => {
        if (cancelled) return;
        setLiveAlbums(albums);
        setHasMore(hasMore);
        if (albums.length === 0) setLiveFailed(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLiveAlbums([]);
        setLiveFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [yupooHost, store]);

  async function loadMore() {
    if (!yupooHost || !store || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { albums, hasMore: more } = await fetchAlbums(yupooHost, next, store.hue);
      setLiveAlbums((prev) => [...(prev ?? []), ...albums]);
      setHasMore(more && albums.length > 0);
      setPage(next);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const placeholderAlbums = useMemo(() => (store ? storeAlbums(store) : []), [store]);
  const liveMode = yupooHost !== null && !liveFailed;
  const albums = liveMode ? (liveAlbums ?? []) : platform.platform === "other" ? placeholderAlbums : [];
  const albumsLoading = liveMode && liveAlbums === null;

  // Real prices live in each album's description, not its title (see
  // AlbumModal) — pull them all in as the grid loads so quick-add uses the
  // real price and shoppers don't have to open every album just to see it.
  const [albumPrices, setAlbumPrices] = useState<Record<string, ParsedPrice | null>>({});
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestedRef.current = new Set();
    setAlbumPrices({});
  }, [yupooHost]);

  useEffect(() => {
    if (!yupooHost) return;
    const toFetch = albums.filter((a) => a.yupooId && !requestedRef.current.has(a.id));
    if (toFetch.length === 0) return;
    for (const a of toFetch) requestedRef.current.add(a.id);

    let cancelled = false;
    let cursor = 0;
    async function worker() {
      while (cursor < toFetch.length) {
        const album = toFetch[cursor++];
        const description = await fetchAlbumDescription(yupooHost!, album.yupooId!);
        if (cancelled) return;
        setAlbumPrices((prev) => ({
          ...prev,
          [album.id]: parsePriceCnyDetailed(description ?? album.name),
        }));
      }
    }
    for (let i = 0; i < Math.min(PRICE_PREFETCH_CONCURRENCY, toFetch.length); i++) worker();
    return () => {
      cancelled = true;
    };
  }, [yupooHost, albums]);

  if (!hydrated) return null;
  if (!store) {
    return (
      <div className="fade-up rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
        Store not found. <Link href="/discover" className="text-neon-300 underline">Back to Discover</Link>
      </div>
    );
  }

  const saved = inLibrary(store.id);
  const fav = favStores.includes(store.id);

  return (
    <div className="fade-up">
      <Link href="/library" className="inline-flex items-center gap-1 text-sm text-mist-500 transition-colors hover:text-mist-100">
        <ArrowLeft size={14} aria-hidden="true" /> Library
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-none border border-white/5 bg-ink-800/80 p-5">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none text-sm font-bold text-white shadow-hard-sm"
          style={{ background: "#1a1a1a" }}
        >
          {store.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-mist-100">
            {store.name}
            <button
              onClick={() => toggleFavStore(store.id)}
              aria-label={fav ? "Unfavorite store" : "Favorite store"}
              aria-pressed={fav}
              className={`p-0.5 ${fav ? "text-amber-300" : "text-mist-500 hover:text-amber-300"}`}
            >
              <Star size={16} aria-hidden="true" className={fav ? "fill-current" : ""} />
            </button>
          </h1>
          <p className="mt-0.5 text-sm text-mist-400">{store.blurb}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {tagDefs
              .filter((t) => t.kind === "store" && store.tags?.includes(t.name))
              .map((t) => (
                <span
                  key={t.id}
                  className="rounded-none border px-2 py-0.5 font-medium"
                  style={{ borderColor: `${t.color}99`, background: `${t.color}22`, color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            {store.categories.map((c) => (
              <span key={c} className="rounded-none border border-white/5 bg-ink-700 px-2 py-0.5 text-mist-400">
                {c}
              </span>
            ))}
            <span className="rounded-none border border-neon-400/20 bg-neon-500/10 px-2 py-0.5 text-neon-300">
              Trust {store.trust}/100
            </span>
            {platform.platform !== "other" && (
              <span className="rounded-none border border-aqua-400/20 bg-aqua-400/10 px-2 py-0.5 text-aqua-300">
                {platform.label}
              </span>
            )}
            <a
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-mist-500 underline decoration-ink-500 hover:text-neon-300"
            >
              source <ExternalLink size={10} aria-hidden="true" />
            </a>
          </div>
        </div>
        {/* BUG FIX: this button used to sit inline with the avatar + text
            column, which had nowhere to shrink to on narrow screens — the
            name/blurb column got crushed down to ~100px instead of the
            button wrapping to its own line. Forcing full width below `sm`
            makes flex-wrap actually drop it to a new row on mobile. */}
        {saved ? (
          <button
            onClick={() => { removeFromLibrary(store.id); toast(`${store.name} removed from library`, "info"); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-none border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 sm:w-auto"
          >
            <Check size={14} aria-hidden="true" /> In library
          </button>
        ) : (
          <button
            onClick={() => { addToLibrary(store.id); toast(`${store.name} added to library`); }}
            className="btn-glow flex w-full items-center justify-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            <Plus size={14} aria-hidden="true" /> Add to library
          </button>
        )}
      </div>

      {(platform.platform === "taobao" || platform.platform === "weidian") && (
        <MarketplacePreview
          store={store}
          label={platform.label}
          weidianUserId={platform.platform === "weidian" ? platform.weidianUserId : undefined}
        />
      )}

      {yupooHost && liveFailed && (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-none border border-white/5 bg-ink-800/60 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-mist-100">Albums unavailable</p>
            <p className="mt-0.5 text-xs text-mist-500">
              Couldn&apos;t load this store&apos;s albums from Yupoo right now — browse it directly instead.
            </p>
          </div>
          <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white"
          >
            Visit on Yupoo <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {(albumsLoading || albums.length > 0) && (
        <>
          <h2 className="mb-4 mt-8 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
            Albums {albumsLoading ? "" : `(${albums.length}${hasMore ? "+" : ""})`}
          </h2>
          {albumsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="overflow-hidden rounded-none border border-white/5 bg-ink-800/80">
                  <div className="tile-shimmer aspect-[4/3] bg-ink-700" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-3/4 rounded bg-ink-700" />
                    <div className="h-2.5 w-1/3 rounded bg-ink-700/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {albums.map((album, i) => {
                // Prefer the bulk-prefetched description price (real, from
                // the seller's listing text); fall back to a title-scanned
                // guess until that fetch lands, or for placeholder albums
                // that never get a description fetch at all.
                const parsedPrice = album.id in albumPrices ? albumPrices[album.id] : parsePriceCnyDetailed(album.name);
                const price = parsedPrice?.value ?? null;
                // Quick-add only makes sense for live Yupoo albums — placeholder
                // albums have no real yupooId/cover to attach a cart line to.
                const canQuickAdd = Boolean(yupooHost && album.yupooId);
                return (
                  <div
                    key={album.id}
                    className="card-pop fade-up group relative overflow-hidden rounded-none border border-white/5 bg-ink-800/80"
                    style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                  >
                    <button onClick={() => setOpenAlbum(album)} className="block w-full text-left">
                      <div
                        className="tile-shimmer relative flex aspect-square items-center justify-center overflow-hidden"
                        style={
                          album.cover && yupooHost
                            ? undefined
                            : { background: "#1a1a1a" }
                        }
                      >
                        {album.cover && yupooHost ? (
                          <img
                            src={proxiedImg(album.cover, yupooHost)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <Images size={22} aria-hidden="true" className="text-white/70" />
                        )}
                        <span className="absolute bottom-2 right-2 rounded-none border border-white/10 bg-ink-950/90 px-2 py-0.5 text-[10px] font-medium text-white/85">
                          {album.photoCount} photos
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-9 text-sm font-medium leading-snug text-mist-100" title={album.name}>
                          {album.name}
                        </p>
                        {price !== null ? (
                          <p className="mt-1.5 text-sm font-semibold tabular-nums text-mist-100">
                            {formatMoney(price, "CNY")}
                            {parsedPrice?.estimate && (
                              <span className="ml-1 font-mono text-[9px] font-normal uppercase tracking-wide text-mist-500">
                                ¥ (est.)
                              </span>
                            )}{" "}
                            <span className="flow-text text-xs font-bold">≈ {fmtConverted(price)}</span>
                          </p>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-mist-500">Tap for details</p>
                        )}
                      </div>
                    </button>

                    {/* Quick add — hover-revealed on desktop, always shown on
                        touch (no hover state) via opacity-100 md:opacity-0. */}
                    {canQuickAdd && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart({
                            id: `album:${yupooHost}:${album.yupooId}`,
                            title: album.name,
                            priceCny: price,
                            image: album.cover ?? null,
                            imgHost: yupooHost,
                            storeId: store!.id,
                            storeName: store!.name,
                            url: null,
                          });
                          toast(`Added ${album.name.slice(0, 40)} to cart`);
                        }}
                        aria-label={`Quick add ${album.name} to cart`}
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-none border border-white/15 bg-ink-950/90 px-2 py-1.5 text-white/90 opacity-100 shadow-hard-sm transition-all duration-150 hover:bg-ink-950 hover:text-white md:opacity-0 md:group-hover:opacity-100"
                      >
                        <ShoppingCart size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {liveMode && hasMore && !albumsLoading && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-none border border-ink-500 px-4 py-2.5 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more albums"}
            </button>
          )}
        </>
      )}

      <h2 className="mb-4 mt-8 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
        Indexed items ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          Nothing indexed from this store yet — items land here as the catalog pipeline picks them up.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}

      {openAlbum && (
        <AlbumModal
          store={store}
          album={openAlbum}
          host={openAlbum.yupooId ? yupooHost : null}
          onClose={() => setOpenAlbum(null)}
        />
      )}
    </div>
  );
}

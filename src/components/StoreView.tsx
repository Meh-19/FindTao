"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Images, Plus, Search, ShoppingCart, Star } from "lucide-react";
import { storeItems } from "@/data/catalog";
import type { StoreInfo } from "@/data/stores";
import { storeAlbums, type Album } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { parsePriceCnyDetailed, type ParsedPrice } from "@/lib/price";
import { formatMoney } from "@/lib/currency";
import { proxiedImg, type YupooAlbum, type YupooAlbumsResponse } from "@/lib/yupoo";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/clientCache";
import { albumItemId, commitAlbumPrice, fetchAlbumDescription, type AlbumScrapeCache } from "@/lib/albumPrice";
import { pickMarketplaceLinks } from "@/lib/links";
import { MARKETPLACE_LABEL } from "@/lib/marketplaceLabel";
import { lastPriceChanges } from "@/lib/priceHistory";
import { PriceDropBadge } from "./PriceDropBadge";
import { StoreAvatar } from "./StoreAvatar";
import { AlbumModal } from "./AlbumModal";
import { ItemCard } from "./ItemCard";
import { useStore, duplicateNotice } from "@/lib/store";

/** Map a raw scraped Yupoo album (the API/cache shape) to the local Album model. */
function toAlbum(a: YupooAlbum, hue: [string, string]): Album {
  return { id: `yupoo-${a.id}`, yupooId: a.id, name: a.title, photoCount: a.count, cover: a.cover, hue };
}

/** Cached shape of a store's first page of albums. */
interface AlbumsCache {
  albums: YupooAlbum[];
  hasMore: boolean;
}

async function fetchAlbums(
  host: string,
  page: number,
  hue: [string, string],
): Promise<{ albums: Album[]; hasMore: boolean }> {
  const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(host)}&page=${page}`);
  if (!res.ok) throw new Error("albums fetch failed");
  const data = (await res.json()) as YupooAlbumsResponse;
  return {
    albums: (data.albums ?? []).map((a) => toAlbum(a, hue)),
    hasMore: data.hasMore ?? false,
  };
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
    favStores, toggleFavStore, toast, toastUndo, hydrated, tagDefs, fmtConverted, addToCart, itemLocations, catalogItems,
    inCart, activeHaul, priceOverrides, setPriceOverride, storeSeen, markStoreSeen, backfillItemUrl,
  } = useStore();
  const store = allStores.find((s) => s.id === id);
  const items = storeItems(catalogItems, id);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // Deep link from a cart/haul item: `?album=<yupooId>` opens that album.
  const albumParam = useSearchParams().get("album");
  const handledAlbumParam = useRef<string | null>(null);

  // Open an album and reflect it in the URL so it's shareable/linkable, without
  // re-triggering the deep-link effect below (we mark it handled here).
  function openAlbumAt(album: Album) {
    setOpenAlbum(album);
    if (album.yupooId) {
      handledAlbumParam.current = album.yupooId;
      router.replace(`${pathname}?album=${album.yupooId}`, { scroll: false });
    }
  }

  function closeAlbum() {
    setOpenAlbum(null);
    if (albumParam) router.replace(pathname, { scroll: false });
  }

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
    setLiveFailed(false);
    setPage(1);

    // Instant paint from the local cache when we have a recent copy; otherwise
    // fall to the loading skeleton until the fetch below lands.
    const cached = cacheGet<AlbumsCache>("alb", yupooHost);
    if (cached) {
      setLiveAlbums(cached.albums.map((a) => toAlbum(a, store.hue)));
      setHasMore(cached.hasMore);
    } else {
      setLiveAlbums(null);
    }

    // Always revalidate in the background so the cache stays fresh (SWR).
    fetch(`/api/yupoo/albums?host=${encodeURIComponent(yupooHost)}&page=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: YupooAlbumsResponse) => {
        if (cancelled) return;
        const list = data.albums ?? [];
        setLiveAlbums(list.map((a) => toAlbum(a, store.hue)));
        setHasMore(data.hasMore ?? false);
        if (list.length === 0 && !cached) setLiveFailed(true);
        cacheSet<AlbumsCache>("alb", yupooHost, { albums: list, hasMore: data.hasMore ?? false }, CACHE_TTL.albums);
      })
      .catch(() => {
        if (cancelled) return;
        // A failed revalidation shouldn't blank a cached list — only fail hard
        // when we had nothing to show.
        if (!cached) {
          setLiveAlbums([]);
          setLiveFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [yupooHost, store]);

  // Open the album named in `?album=` (arriving from a cart/haul item link).
  // Prefer the loaded list entry; if it isn't on the first page, open a minimal
  // one — AlbumModal fetches its own photos/price from host + id anyway. Handled
  // once per distinct id so closing the modal doesn't immediately reopen it.
  useEffect(() => {
    if (!albumParam) {
      handledAlbumParam.current = null;
      return;
    }
    if (!yupooHost || !store || handledAlbumParam.current === albumParam) return;
    const found = (liveAlbums ?? []).find((a) => a.yupooId === albumParam);
    if (found) {
      handledAlbumParam.current = albumParam;
      setOpenAlbum(found);
    } else if (liveAlbums !== null) {
      handledAlbumParam.current = albumParam;
      setOpenAlbum({ id: `yupoo-${albumParam}`, yupooId: albumParam, name: "", photoCount: 0, cover: null, hue: store.hue });
    }
  }, [albumParam, liveAlbums, yupooHost, store]);

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

  // "New release" tracking: on this visit, albums not seen before this store was
  // last opened get a glowing ring that clears when the shopper hovers them.
  const [unseenNew, setUnseenNew] = useState<Set<string>>(new Set());
  const seenBaseline = useRef<Set<string> | null>(null); // frozen at first load, so live marking doesn't erase glow
  const processedNew = useRef<Set<string>>(new Set());
  // Editing a tile's price inline (one at a time).
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  // Client-side title search over the loaded albums (same idea as the Search tab).
  const [albumQuery, setAlbumQuery] = useState("");
  const albumQ = albumQuery.trim().toLowerCase();
  const visibleAlbums = albumQ
    ? albums.filter((a) => albumQ.split(/\s+/).every((w) => a.name.toLowerCase().includes(w)))
    : albums;

  useEffect(() => {
    // Reset per-store when navigating between stores.
    seenBaseline.current = null;
    processedNew.current = new Set();
    setUnseenNew(new Set());
    setAlbumQuery("");
  }, [id]);

  useEffect(() => {
    if (!liveMode || albums.length === 0) return;
    if (!seenBaseline.current) seenBaseline.current = new Set(storeSeen[id] ?? []);
    const baseline = seenBaseline.current;
    const currentIds: string[] = [];
    const fresh: string[] = [];
    for (const a of albums) {
      currentIds.push(a.id);
      if (!processedNew.current.has(a.id)) {
        processedNew.current.add(a.id);
        if (!baseline.has(a.id)) fresh.push(a.id);
      }
    }
    if (fresh.length) setUnseenNew((prev) => new Set([...prev, ...fresh]));
    markStoreSeen(id, currentIds); // mark all current as seen so the Library badge clears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albums, liveMode, id]);

  function clearNew(albumId: string) {
    if (!unseenNew.has(albumId)) return;
    setUnseenNew((prev) => {
      const next = new Set(prev);
      next.delete(albumId);
      return next;
    });
  }

  function savePrice(cid: string) {
    const v = priceDraft.trim();
    setPriceOverride(cid, v === "" ? null : Number(v));
    setEditingPriceId(null);
  }

  // Real prices live in each album's description, not its title (see
  // AlbumModal) — pull them all in as the grid loads so quick-add uses the
  // real price and shoppers don't have to open every album just to see it.
  const [albumPrices, setAlbumPrices] = useState<Record<string, ParsedPrice | null>>({});
  // Raw marketplace links from the same description scrape — what makes an
  // album a real product (agent hand-off, accurate cart line) and not just photos.
  const [albumLinks, setAlbumLinks] = useState<Record<string, string[]>>({});
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestedRef.current = new Set();
    setAlbumPrices({});
    setAlbumLinks({});
  }, [yupooHost]);

  useEffect(() => {
    if (!yupooHost) return;

    // Seed prices we already have cached (no network), and only fetch the rest.
    // Cached values include a genuine "no price found" (stored as {p:null}) so
    // we don't re-scrape a description that never had one — see cacheSet below.
    const seeded: Record<string, ParsedPrice | null> = {};
    const seededLinks: Record<string, string[]> = {};
    const toFetch: { id: string; yupooId: string; name: string }[] = [];
    for (const a of albums) {
      if (!a.yupooId || requestedRef.current.has(a.id)) continue;
      const cached = cacheGet<AlbumScrapeCache>("price", `${yupooHost}:${a.yupooId}`);
      if (cached) {
        requestedRef.current.add(a.id);
        seeded[a.id] = cached.p;
        if (cached.l) seededLinks[a.id] = cached.l;
      } else {
        toFetch.push({ id: a.id, yupooId: a.yupooId, name: a.name });
      }
    }
    if (Object.keys(seeded).length > 0) setAlbumPrices((prev) => ({ ...prev, ...seeded }));
    if (Object.keys(seededLinks).length > 0) setAlbumLinks((prev) => ({ ...prev, ...seededLinks }));
    if (toFetch.length === 0) return;
    for (const a of toFetch) requestedRef.current.add(a.id);

    let cancelled = false;
    let cursor = 0;
    async function worker() {
      while (cursor < toFetch.length) {
        const album = toFetch[cursor++];
        let result = await fetchAlbumDescription(yupooHost!, album.yupooId);
        // Back off and retry on rate-limit (bounded) rather than silently
        // falling back to the title and showing no price for this album.
        for (let attempt = 0; result.rateLimited && attempt < 2 && !cancelled; attempt++) {
          await new Promise((r) => setTimeout(r, result.rateLimited ? result.retryAfterMs : 0));
          if (cancelled) return;
          result = await fetchAlbumDescription(yupooHost!, album.yupooId);
        }
        if (cancelled) return;
        const description = result.rateLimited ? null : result.description;
        const parsed = parsePriceCnyDetailed(description ?? album.name);
        setAlbumPrices((prev) => ({ ...prev, [album.id]: parsed }));
        // Cache (and log to price history) only a real lookup — a rate-limited
        // miss should retry next time, and must never land in the history.
        if (!result.rateLimited) {
          setAlbumLinks((prev) => ({ ...prev, [album.id]: result.links }));
          commitAlbumPrice(yupooHost!, album.yupooId, parsed, result.links);
        }
      }
    }
    for (let i = 0; i < Math.min(PRICE_PREFETCH_CONCURRENCY, toFetch.length); i++) worker();
    return () => {
      cancelled = true;
    };
  }, [yupooHost, albums]);

  // Anything already in the cart or a haul that predates link scraping (or was
  // quick-added before this store's descriptions loaded) gets its real product
  // link filled in as the grid learns it.
  useEffect(() => {
    if (!yupooHost) return;
    for (const [albumId, raw] of Object.entries(albumLinks)) {
      const best = pickMarketplaceLinks(raw).best;
      const yupooId = albums.find((a) => a.id === albumId)?.yupooId;
      if (best && yupooId) backfillItemUrl(albumItemId(yupooHost, yupooId), best.rawUrl);
    }
  }, [albumLinks, albums, yupooHost, backfillItemUrl]);

  // Price moves for the albums on screen, recomputed when a prefetch lands
  // (that's what writes the history) rather than on every render.
  const priceMoves = useMemo(() => {
    if (!yupooHost) return {};
    const ids = albums.filter((a) => a.yupooId).map((a) => albumItemId(yupooHost, a.yupooId!));
    const byItemId = lastPriceChanges(ids);
    return Object.fromEntries(
      albums
        .filter((a) => a.yupooId)
        .map((a) => [a.id, byItemId[albumItemId(yupooHost, a.yupooId!)] ?? null]),
    );
  }, [albums, yupooHost, albumPrices]);

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
        <StoreAvatar store={store} className="h-14 w-14 rounded-none text-sm shadow-hard-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-mist-100">
            {store.name}
            <button
              onClick={() => toggleFavStore(store.id)}
              aria-label={fav ? "Unfavorite store" : "Favorite store"}
              aria-pressed={fav}
              className={`p-0.5 ${fav ? "text-warning" : "text-mist-500 hover:text-warning"}`}
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
            onClick={() => toastUndo(`${store.name} removed from library`, removeFromLibrary(store.id))}
            className="flex w-full items-center justify-center gap-1.5 rounded-none border border-success/40 bg-success/10 px-4 py-2 text-sm font-medium text-success sm:w-auto"
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
          <div className="mb-4 mt-8 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
              Albums {albumsLoading ? "" : `(${albumQ ? `${visibleAlbums.length}/` : ""}${albums.length}${hasMore ? "+" : ""})`}
            </h2>
            {!albumsLoading && albums.length > 0 && (
              <div className="relative w-full sm:ml-auto sm:w-72">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                />
                <input
                  value={albumQuery}
                  onChange={(e) => setAlbumQuery(e.target.value)}
                  placeholder="Search this store's albums…"
                  className="w-full rounded-none border border-ink-500 bg-ink-900 py-2 pl-9 pr-3 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500"
                />
              </div>
            )}
          </div>
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
          ) : visibleAlbums.length === 0 ? (
            <p className="rounded-none border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-400">
              No albums match &ldquo;{albumQuery.trim()}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleAlbums.map((album, i) => {
                // Prefer the bulk-prefetched description price (real, from
                // the seller's listing text); fall back to a title-scanned
                // guess until that fetch lands, or for placeholder albums
                // that never get a description fetch at all.
                const parsedPrice = album.id in albumPrices ? albumPrices[album.id] : parsePriceCnyDetailed(album.name);
                const parsed = parsedPrice?.value ?? null;
                // Quick-add only makes sense for live Yupoo albums — placeholder
                // albums have no real yupooId/cover to attach a cart line to.
                const canQuickAdd = Boolean(yupooHost && album.yupooId);
                const cartId = canQuickAdd ? `album:${yupooHost}:${album.yupooId}` : null;
                const override = cartId ? priceOverrides[cartId] : undefined;
                const price = override ?? parsed; // effective price (manual override wins)
                const inCartNow = !!cartId && inCart(cartId);
                const inHaulNow = !!cartId && activeHaul.items.some((it) => it.id === cartId);
                const isNew = unseenNew.has(album.id);
                const isEditing = editingPriceId === album.id;
                // The seller's real Taobao/Weidian listing, scraped from the
                // description — this is what turns a tile into a buyable product.
                const market = pickMarketplaceLinks(albumLinks[album.id] ?? []);
                return (
                  <div
                    key={album.id}
                    onMouseEnter={() => clearNew(album.id)}
                    className={`card-pop fade-up group relative overflow-hidden rounded-none border bg-ink-800/80 transition-shadow duration-500 ${
                      inCartNow || inHaulNow
                        ? "border-success/50"
                        : isNew
                          ? "border-neon-400/70"
                          : "border-white/5"
                    } ${isNew ? "shadow-[0_0_14px_rgba(139,92,246,0.55)]" : ""}`}
                    style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                  >
                    {(inCartNow || inHaulNow || isNew) && (
                      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
                        {isNew && (
                          <span className="rounded-none border border-neon-400/70 bg-neon-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neon-200">
                            New
                          </span>
                        )}
                        {inCartNow && (
                          <span className="flex items-center gap-1 rounded-none border border-success/50 bg-ink-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">
                            <Check size={9} aria-hidden="true" /> In cart
                          </span>
                        )}
                        {inHaulNow && (
                          <span className="flex items-center gap-1 rounded-none border border-neon-400/50 bg-ink-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neon-300">
                            <Check size={9} aria-hidden="true" /> In haul
                          </span>
                        )}
                      </div>
                    )}
                    <button onClick={() => openAlbumAt(album)} className="block w-full text-left">
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
                            {override !== undefined ? (
                              <span className="ml-1 font-mono text-[9px] font-normal uppercase tracking-wide text-neon-300">
                                set
                              </span>
                            ) : parsedPrice?.estimate ? (
                              <span className="ml-1 font-mono text-[9px] font-normal uppercase tracking-wide text-mist-500">
                                ¥ (est.)
                              </span>
                            ) : null}{" "}
                            <span className="flow-text text-xs font-bold">≈ {fmtConverted(price)}</span>
                          </p>
                        ) : null}
                        {/* A move only shows on the scraped price — a manual override is the shopper's own number. */}
                        {override === undefined && <PriceDropBadge change={priceMoves[album.id] ?? null} className="mt-1.5" />}
                        {market.all.length > 0 && (
                          <p className="mt-1.5 flex flex-wrap gap-1">
                            {market.all.map((l) => (
                              <span
                                key={l.marketplace}
                                title={`Seller listed this on ${MARKETPLACE_LABEL[l.marketplace]} — hand it straight to your agent`}
                                className="border border-aqua-400/30 bg-aqua-400/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-aqua-300"
                              >
                                {MARKETPLACE_LABEL[l.marketplace]}
                              </span>
                            ))}
                          </p>
                        )}
                        {price === null && (
                          <p className="mt-1.5 text-[11px] text-mist-500">
                            {canQuickAdd ? "No price — tap ¥ to set" : "Tap for details"}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Set-price + quick-add — hover-revealed on desktop, always
                        shown on touch (no hover state) via opacity-100 md:opacity-0. */}
                    {canQuickAdd &&
                      (isEditing ? (
                        <div className="absolute right-2 top-2 z-20">
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") savePrice(cartId!);
                              if (e.key === "Escape") setEditingPriceId(null);
                            }}
                            onBlur={() => savePrice(cartId!)}
                            placeholder="¥ price"
                            className="w-20 rounded-none border border-neon-500 bg-ink-950 px-1.5 py-1 text-xs text-mist-100 outline-none"
                          />
                        </div>
                      ) : (
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPriceDraft(price !== null ? String(price) : "");
                              setEditingPriceId(album.id);
                            }}
                            aria-label={`Set price for ${album.name}`}
                            title="Set price"
                            className="flex items-center rounded-none border border-white/15 bg-ink-950/90 px-2 py-1.5 text-xs font-bold text-white/90 shadow-hard-sm transition-all duration-150 hover:bg-ink-950 hover:text-white"
                          >
                            ¥
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const notice = duplicateNotice(itemLocations(`album:${yupooHost}:${album.yupooId}`));
                              addToCart({
                                id: `album:${yupooHost}:${album.yupooId}`,
                                title: album.name,
                                priceCny: price,
                                image: album.cover ?? null,
                                imgHost: yupooHost,
                                storeId: store!.id,
                                storeName: store!.name,
                                url: market.best?.rawUrl ?? null,
                              });
                              toast(notice ?? `Added ${album.name.slice(0, 40)} to cart`, notice ? "info" : "success");
                            }}
                            aria-label={`Quick add ${album.name} to cart`}
                            className="flex items-center gap-1 rounded-none border border-white/15 bg-ink-950/90 px-2 py-1.5 text-white/90 shadow-hard-sm transition-all duration-150 hover:bg-ink-950 hover:text-white"
                          >
                            <ShoppingCart size={13} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
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
          onClose={closeAlbum}
        />
      )}
    </div>
  );
}

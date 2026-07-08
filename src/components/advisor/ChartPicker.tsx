"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImageOff, Images, Link2, Loader2, Search, ShoppingBasket } from "lucide-react";
import { useStore, type SavedItem } from "@/lib/store";
import { proxiedImg, isValidYupooHost, type YupooAlbumsResponse } from "@/lib/yupoo";

export interface ChartSelection {
  host: string;
  storeId: string | null;
  storeName: string;
  /** Raw (unproxied) photo.yupoo.com URL — what analyze-chart actually fetches. */
  photoUrl: string;
}

interface AlbumSummary {
  id: string;
  title: string;
  count: number;
  cover: string | null;
}

interface Target {
  host: string;
  albumId: string;
  storeId: string | null;
  storeName: string;
}

/** `https://firerep.x.yupoo.com/albums/242172013?uid=1` → { host, albumId }. Trailing path/query ignored. */
function parseYupooAlbumUrl(raw: string): { host: string; albumId: string } | null {
  const m = raw.trim().match(/^(?:https?:\/\/)?([a-z0-9-]+)\.x\.yupoo\.com\/albums\/(\d+)/i);
  if (!m || !isValidYupooHost(m[1])) return null;
  return { host: m[1].toLowerCase(), albumId: m[2] };
}

/** A bare store URL/subdomain with no /albums/ path — "https://firerep.x.yupoo.com" or just "firerep". */
function parseYupooHostUrl(raw: string): string | null {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.x\.yupoo\.com\b/i);
  if (m && isValidYupooHost(m[1])) return m[1].toLowerCase();
  if (/^[a-z0-9-]+$/i.test(trimmed) && isValidYupooHost(trimmed)) return trimmed.toLowerCase();
  return null;
}

/** `album:firerep:242172013` (the id format used by album-sourced cart/haul lines) → { host, albumId }. */
function parseAlbumItemId(id: string): { host: string; albumId: string } | null {
  const m = id.match(/^album:([a-z0-9-]+):(\d+)$/i);
  return m ? { host: m[1], albumId: m[2] } : null;
}

/** Search across the cart and every haul for album-backed items — dedup by id, most recent haul wins the label. */
function useHaulAlbumItems(): (SavedItem & { host: string; albumId: string })[] {
  const { cart, hauls } = useStore();
  return useMemo(() => {
    const all = [...cart, ...hauls.flatMap((h) => h.items)];
    const byId = new Map<string, SavedItem>();
    for (const item of all) byId.set(item.id, item);
    const out: (SavedItem & { host: string; albumId: string })[] = [];
    for (const item of byId.values()) {
      const parsed = parseAlbumItemId(item.id);
      if (parsed) out.push({ ...item, ...parsed });
    }
    return out;
  }, [cart, hauls]);
}

function HaulSearch({ onPick }: { onPick: (t: Target) => void }) {
  const items = useHaulAlbumItems();
  const [query, setQuery] = useState("");

  if (items.length === 0) return null;

  const filtered = query.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div className="border border-white/5 bg-ink-800/80 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
        <ShoppingBasket size={14} aria-hidden="true" /> From your haul
      </p>
      <p className="mt-0.5 text-xs text-mist-500">Pick something you've already added to your cart or a haul.</p>
      <div className="relative mt-3">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your haul…"
          className="w-full rounded-none border border-ink-500 bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
        />
      </div>
      <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-mist-500">No haul items match &ldquo;{query}&rdquo;.</p>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onPick({ host: item.host, albumId: item.albumId, storeId: item.storeId || null, storeName: item.storeName })}
              className="flex w-full items-center gap-3 border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/10 hover:bg-white/5"
            >
              {item.image && item.imgHost ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxiedImg(item.image, item.imgHost)} alt="" className="h-10 w-10 shrink-0 border border-white/5 object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/5 bg-ink-700 text-mist-500">
                  <ImageOff size={14} aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-mist-100">{item.title}</span>
                <span className="block truncate text-xs text-mist-500">{item.storeName}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AlbumBrowser({
  host,
  storeId,
  storeName,
  onBack,
  onPick,
}: {
  host: string;
  storeId: string | null;
  storeName: string;
  onBack: () => void;
  onPick: (t: Target) => void;
}) {
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAlbums(null);
    setError(null);
    setPage(1);
    fetch(`/api/yupoo/albums?host=${encodeURIComponent(host)}&page=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: YupooAlbumsResponse) => {
        if (cancelled) return;
        setAlbums(data.albums ?? []);
        setHasMore(data.hasMore ?? false);
        if ((data.albums ?? []).length === 0) setError("Couldn't find any albums for that store.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load that store's albums.");
      });
    return () => {
      cancelled = true;
    };
  }, [host]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(host)}&page=${next}`);
      const data = (await res.json()) as YupooAlbumsResponse;
      setAlbums((prev) => [...(prev ?? []), ...(data.albums ?? [])]);
      setHasMore((data.hasMore ?? false) && (data.albums ?? []).length > 0);
      setPage(next);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    if (!albums) return null;
    const q = query.trim().toLowerCase();
    return q ? albums.filter((a) => a.title.toLowerCase().includes(q)) : albums;
  }, [albums, query]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-mist-300">
          Browsing <span className="font-semibold text-mist-100">{storeName}</span> — find the garment, then pick its size chart photo
        </p>
        <button onClick={onBack} className="text-xs text-mist-500 underline decoration-ink-500 hover:text-mist-300">
          Choose a different store
        </button>
      </div>

      <div className="relative mb-3">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this store's albums…"
          className="w-full rounded-none border border-ink-500 bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
        />
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-400">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      ) : albums === null ? (
        <div className="flex items-center justify-center gap-2 border border-dashed border-ink-500 py-12 text-sm text-mist-400">
          <Loader2 size={16} aria-hidden="true" className="animate-spin" /> Loading albums…
        </div>
      ) : filtered && filtered.length === 0 ? (
        <p className="border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-400">
          No albums match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filtered!.map((album) => (
            <button
              key={album.id}
              onClick={() => onPick({ host, albumId: album.id, storeId, storeName })}
              className="group overflow-hidden border border-white/5 text-left transition-colors hover:border-white"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink-700">
                {album.cover ? (
                  <img
                    src={proxiedImg(album.cover, host)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                  />
                ) : (
                  <Images size={20} aria-hidden="true" className="text-white/50" />
                )}
              </div>
              <p className="line-clamp-2 p-2 text-xs text-mist-200">{album.title}</p>
            </button>
          ))}
        </div>
      )}

      {albums && hasMore && !query && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full border border-ink-500 px-4 py-2.5 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more albums"}
        </button>
      )}
    </div>
  );
}

/**
 * Haul search → store album browser → photo picker for the AI Advisor: the
 * shopper points at whichever photo shows the size chart, and that's what
 * gets sent to the chart-reading API. Three entry paths: something already
 * in the cart/a haul, a full store browsed to find the exact garment, or a
 * specific album URL pasted directly (skips straight to the photo grid).
 */
export function ChartPicker({ onPick }: { onPick: (selection: ChartSelection) => void }) {
  const { allStores, library } = useStore();
  const libraryYupooStores = useMemo(
    () => allStores.filter((s) => library.includes(s.id) && /\.x\.yupoo\.com/i.test(s.url)),
    [allStores, library],
  );

  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [browsing, setBrowsing] = useState<{ host: string; storeId: string | null; storeName: string } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [photosError, setPhotosError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setPhotos(null);
    setPhotosError(null);
    fetch(`/api/yupoo/album?host=${encodeURIComponent(target.host)}&id=${target.albumId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { photos?: string[] }) => {
        if (cancelled) return;
        const list = data.photos ?? [];
        if (list.length === 0) setPhotosError("That album has no photos to pick from.");
        setPhotos(list);
      })
      .catch(() => {
        if (!cancelled) setPhotosError("Couldn't load that album's photos.");
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  function openLibraryStore() {
    setError(null);
    const store = libraryYupooStores.find((s) => s.id === selectedStoreId);
    if (!store) {
      setError("Pick a store first");
      return;
    }
    const host = parseYupooHostUrl(store.url);
    if (!host) {
      setError("Couldn't read that store's Yupoo host");
      return;
    }
    setBrowsing({ host, storeId: store.id, storeName: store.name });
  }

  function submitPastedUrl() {
    setError(null);
    const album = parseYupooAlbumUrl(pastedUrl);
    if (album) {
      const known = allStores.find((s) => s.url.toLowerCase().includes(`${album.host}.x.yupoo.com`));
      setTarget({ host: album.host, albumId: album.albumId, storeId: known?.id ?? null, storeName: known?.name ?? album.host });
      return;
    }
    const host = parseYupooHostUrl(pastedUrl);
    if (host) {
      const known = allStores.find((s) => s.url.toLowerCase().includes(`${host}.x.yupoo.com`));
      setBrowsing({ host, storeId: known?.id ?? null, storeName: known?.name ?? host });
      return;
    }
    setError("That doesn't look like a Yupoo store or album URL");
  }

  // Photo-grid stage — reached from a haul pick, an album pick in the
  // browser, or a pasted album URL.
  if (target) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-mist-300">
            Tap the photo that shows the <span className="font-semibold text-mist-100">size chart</span>
          </p>
          <button
            onClick={() => setTarget(null)}
            className="text-xs text-mist-500 underline decoration-ink-500 hover:text-mist-300"
          >
            Back
          </button>
        </div>

        {photosError ? (
          <p className="flex items-center gap-1.5 border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-400">
            <AlertTriangle size={14} aria-hidden="true" /> {photosError}
          </p>
        ) : photos === null ? (
          <div className="flex items-center justify-center gap-2 border border-dashed border-ink-500 py-12 text-sm text-mist-400">
            <Loader2 size={16} aria-hidden="true" className="animate-spin" /> Loading photos…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo, i) => (
              <button
                key={photo}
                onClick={() => onPick({ host: target.host, storeId: target.storeId, storeName: target.storeName, photoUrl: photo })}
                aria-label={`Use photo ${i + 1} as the size chart`}
                className="group aspect-square overflow-hidden border border-white/5 transition-colors hover:border-white"
              >
                <img
                  src={proxiedImg(photo, target.host)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                />
              </button>
            ))}
          </div>
        )}
        {photos && photos.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-mist-500">
            <Images size={12} aria-hidden="true" /> {photos.length} photos — usually the chart is near the end of the album.
          </p>
        )}
      </div>
    );
  }

  // Store-browsing stage — a searchable grid of every album in the store.
  if (browsing) {
    return (
      <AlbumBrowser
        host={browsing.host}
        storeId={browsing.storeId}
        storeName={browsing.storeName}
        onBack={() => setBrowsing(null)}
        onPick={setTarget}
      />
    );
  }

  return (
    <div className="space-y-4">
      <HaulSearch onPick={setTarget} />

      {libraryYupooStores.length > 0 && (
        <div className="border border-white/5 bg-ink-800/80 p-4">
          <p className="text-sm font-semibold text-mist-100">Browse a store from your library</p>
          <p className="mt-0.5 text-xs text-mist-500">Search the whole store to find the exact garment you want advice on.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="flex-1 rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 outline-none focus:border-neon-500"
            >
              <option value="">Choose a store</option>
              {libraryYupooStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={openLibraryStore} className="btn-glow flex items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white">
              Browse
            </button>
          </div>
        </div>
      )}

      <div className="border border-white/5 bg-ink-800/80 p-4">
        <p className="text-sm font-semibold text-mist-100">Or paste a Yupoo URL</p>
        <p className="mt-0.5 text-xs text-mist-500">
          A store link (browses the whole store) or a specific album link (jumps straight to its photos) — works for any Yupoo store.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            placeholder="https://firerep.x.yupoo.com or .../albums/242172013"
            className="flex-1 rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
          />
          <button onClick={submitPastedUrl} className="btn-glow flex items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white">
            <Link2 size={14} aria-hidden="true" /> Go
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

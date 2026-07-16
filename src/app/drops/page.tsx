"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Images, Loader2, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { proxiedImg, type YupooAlbum, type YupooAlbumsResponse } from "@/lib/yupoo";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/clientCache";
import { libraryYupooStores, localAlbumId, type YupooStoreRef } from "@/lib/yupooStores";
import { parsePriceCnyDetailed, type ParsedPrice } from "@/lib/price";
import { formatMoney } from "@/lib/currency";
import { StoreAvatar } from "@/components/StoreAvatar";

/** Stores scraped at once — the Yupoo routes are rate limited, so don't stampede them. */
const CONCURRENCY = 3;

interface StoreDrops {
  store: YupooStoreRef;
  albums: YupooAlbum[];
}

/**
 * "What's new since you last looked", across every followed Yupoo store.
 *
 * A store the shopper has never opened has no seen-record, which would make
 * *every* album read as new and bury the real drops — so a first sighting
 * silently baselines the store instead, and drops surface from then on.
 */
export default function DropsPage() {
  const { allStores, library, storeSeen, markStoreSeen, hydrated, fmtConverted } = useStore();
  const stores = useMemo(() => libraryYupooStores(allStores, library), [allStores, library]);
  // `allStores` gets a new identity whenever the directory refreshes, which would
  // re-run the scrape effect and cancel the in-flight pass. Key off the hosts
  // themselves so it only re-runs when the set of stores actually changes.
  const storesKey = stores.map((s) => s.host).join(",");

  const [albumsByHost, setAlbumsByHost] = useState<Record<string, YupooAlbum[]>>({});
  const [loading, setLoading] = useState(false);
  const [baselined, setBaselined] = useState<string[]>([]);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  // Freeze what was seen at mount. The store pages mark albums seen as you visit
  // them; without this snapshot the feed would erase itself while you use it.
  const baseline = useRef<Record<string, string[]> | null>(null);
  const fetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated || stores.length === 0) return;
    if (!baseline.current) baseline.current = storeSeen;
    const todo = stores.filter((s) => !fetched.current.has(s.host));
    if (todo.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    // Paint instantly from listings cached by the store pages, then revalidate —
    // a drop feed that only reflects a 12h-old cache would miss the point.
    const seeded: Record<string, YupooAlbum[]> = {};
    for (const s of todo) {
      const cached = cacheGet<{ albums: YupooAlbum[]; hasMore: boolean }>("alb", s.host);
      if (cached) seeded[s.host] = cached.albums;
    }
    if (Object.keys(seeded).length > 0) setAlbumsByHost((prev) => ({ ...prev, ...seeded }));

    setLoading(true);
    let cursor = 0;
    async function worker() {
      while (cursor < todo.length) {
        const s = todo[cursor++];
        fetched.current.add(s.host);
        try {
          const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(s.host)}&page=1`);
          if (!res.ok) continue;
          const data = (await res.json()) as YupooAlbumsResponse;
          const albums = data.albums ?? [];
          if (albums.length === 0) continue;
          cacheSet("alb", s.host, { albums, hasMore: data.hasMore ?? false }, CACHE_TTL.albums);
          // Cancelled mid-flight: un-mark it so the next pass actually re-fetches
          // rather than treating this store as done with no albums to show.
          if (cancelled) {
            fetched.current.delete(s.host);
            return;
          }
          setAlbumsByHost((prev) => ({ ...prev, [s.host]: albums }));

          // Never looked at this store before? Baseline it rather than calling all 120 albums a drop.
          if (!baseline.current?.[s.id]?.length) {
            markStoreSeen(s.id, albums.map((a) => localAlbumId(a.id)));
            setBaselined((prev) => (prev.includes(s.name) ? prev : [...prev, s.name]));
          }
        } catch {
          /* a store that won't load just contributes nothing to the feed */
        }
      }
    }
    Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, () => worker())).then(() => {
      if (cancelled) return;
      setLoading(false);
      setCheckedAt(Date.now());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, storesKey]);

  const drops = useMemo<StoreDrops[]>(() => {
    const out: StoreDrops[] = [];
    for (const store of stores) {
      const albums = albumsByHost[store.host];
      const seen = baseline.current?.[store.id];
      // No albums loaded, or a store baselined this session — nothing to report.
      if (!albums || !seen?.length) continue;
      const seenSet = new Set(seen);
      const fresh = albums.filter((a) => !seenSet.has(localAlbumId(a.id)));
      if (fresh.length > 0) out.push({ store, albums: fresh });
    }
    // Busiest store first — that's where the interesting drop usually is.
    return out.sort((a, b) => b.albums.length - a.albums.length);
  }, [stores, albumsByHost]);

  const total = drops.reduce((sum, d) => sum + d.albums.length, 0);

  function markAllSeen() {
    for (const { store } of drops) {
      const albums = albumsByHost[store.host] ?? [];
      markStoreSeen(store.id, albums.map((a) => localAlbumId(a.id)));
    }
    // Fold the newly-seen ids into the frozen baseline so the feed clears too.
    const next = { ...(baseline.current ?? {}) };
    for (const { store } of drops) {
      const albums = albumsByHost[store.host] ?? [];
      next[store.id] = [...new Set([...(next[store.id] ?? []), ...albums.map((a) => localAlbumId(a.id))])];
    }
    baseline.current = next;
    setAlbumsByHost((prev) => ({ ...prev })); // re-run the drops memo against the new baseline
  }

  if (!hydrated) return null;

  return (
    <div className="fade-up py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <Zap size={26} aria-hidden="true" className="text-neon-300" />
          New <span className="flow-text">drops</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Everything your followed stores have posted since you last looked. Opening a store clears its drops.
        </p>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          Follow some Yupoo stores from{" "}
          <Link href="/discover" className="text-neon-300 hover:text-neon-400">
            Discover
          </Link>{" "}
          and their new albums will land here.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 border border-white/10 bg-ink-800/80 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-mist-300">
              {loading && <Loader2 size={14} aria-hidden="true" className="animate-spin text-mist-400" />}
              {loading ? (
                `Checking ${stores.length} store${stores.length === 1 ? "" : "s"}…`
              ) : total > 0 ? (
                <>
                  <span className="font-semibold text-neon-300">{total}</span> new album
                  {total === 1 ? "" : "s"} across {drops.length} store{drops.length === 1 ? "" : "s"}
                </>
              ) : (
                `Nothing new across your ${stores.length} store${stores.length === 1 ? "" : "s"}.`
              )}
            </p>
            {total > 0 && (
              <button
                onClick={markAllSeen}
                className="ml-auto rounded-none border border-ink-500 px-3 py-1.5 text-xs font-medium text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300"
              >
                Mark all seen
              </button>
            )}
          </div>

          {baselined.length > 0 && (
            <p className="mb-4 border border-aqua-400/30 bg-aqua-400/5 px-4 py-2.5 text-[11px] text-aqua-300">
              First look at {baselined.join(", ")} — noted what&apos;s there now, so anything posted from here on
              shows up as a drop.
            </p>
          )}

          {drops.map(({ store, albums }) => {
            const info = allStores.find((s) => s.id === store.id);
            return (
              <section key={store.host} className="mb-8">
                <div className="mb-3 flex items-center gap-2.5">
                  {info && <StoreAvatar store={info} className="h-7 w-7 rounded-none text-[10px]" />}
                  <Link
                    href={`/store/${store.id}`}
                    className="font-display text-lg font-bold tracking-tight text-mist-100 transition-colors hover:text-neon-300"
                  >
                    {store.name}
                  </Link>
                  <span className="rounded-none border border-neon-400/40 bg-neon-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon-300">
                    {albums.length} new
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {albums.map((album) => (
                    <DropCard key={album.id} album={album} store={store} fmtConverted={fmtConverted} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {checkedAt && !loading && (
        <p className="mt-2 text-center text-[11px] text-mist-500">
          Checked {new Date(checkedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function DropCard({
  album,
  store,
  fmtConverted,
}: {
  album: YupooAlbum;
  store: YupooStoreRef;
  fmtConverted: (cny: number) => string;
}) {
  // Only show a price we already have — the feed must not fire a scrape per album.
  const cached = cacheGet<{ p: ParsedPrice | null }>("price", `${store.host}:${album.id}`);
  const price = (cached ? cached.p : parsePriceCnyDetailed(album.title))?.value ?? null;

  return (
    <Link
      href={`/store/${store.id}?album=${album.id}`}
      className="group overflow-hidden border border-neon-400/40 bg-ink-800/80 transition-colors hover:border-white"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink-700">
        {album.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImg(album.cover, store.host)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
          />
        ) : (
          <Images size={20} aria-hidden="true" className="text-white/50" />
        )}
      </div>
      <div className="p-2">
        <p className="line-clamp-2 min-h-8 text-xs text-mist-200">{album.title}</p>
        {price !== null ? (
          <p className="mt-1 text-xs font-semibold tabular-nums text-mist-100">
            {formatMoney(price, "CNY")} <span className="flow-text font-bold">≈ {fmtConverted(price)}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-mist-500">{album.count} photos</p>
        )}
      </div>
    </Link>
  );
}

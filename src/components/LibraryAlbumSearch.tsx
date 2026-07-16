"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Images, Loader2, Store } from "lucide-react";
import { useStore } from "@/lib/store";
import { proxiedImg, type YupooAlbum, type YupooAlbumsResponse } from "@/lib/yupoo";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/clientCache";
import { libraryYupooStores } from "@/lib/yupooStores";

/**
 * Live album search across every Yupoo store in the user's Library — the
 * "search all my stores at once" half of Browse (the catalog half is the grid
 * above). Each followed store's first page of albums is fetched once (lazily,
 * only after a real query is typed) and cached, then filtered client-side as
 * the query changes, so typing never re-hits the network.
 */
export function LibraryAlbumSearch({ query }: { query: string }) {
  const { allStores, library } = useStore();

  const yupooStores = useMemo(() => libraryYupooStores(allStores, library), [allStores, library]);

  const [albumsByHost, setAlbumsByHost] = useState<Record<string, YupooAlbum[]>>({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const active = q.length >= 2;

  // Fetch page 1 for any followed store we haven't pulled yet — but only once a
  // real query exists, so an idle Browse page makes zero Yupoo requests.
  useEffect(() => {
    if (!active) return;
    const todo = yupooStores.filter((s) => !fetchedRef.current.has(s.host));
    if (todo.length === 0) return;
    let cancelled = false;

    // Seed instantly from cached listings (shared with the store pages), so a
    // store you've already opened searches with zero network wait.
    const seeded: Record<string, YupooAlbum[]> = {};
    for (const s of todo) {
      const cached = cacheGet<{ albums: YupooAlbum[]; hasMore: boolean }>("alb", s.host);
      if (cached) seeded[s.host] = cached.albums;
    }
    if (Object.keys(seeded).length > 0) setAlbumsByHost((prev) => ({ ...prev, ...seeded }));

    setLoading(true);
    Promise.all(
      todo.map(async (s): Promise<[string, YupooAlbum[]]> => {
        fetchedRef.current.add(s.host);
        try {
          const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(s.host)}&page=1`);
          if (!res.ok) return [s.host, seeded[s.host] ?? []];
          const data = (await res.json()) as YupooAlbumsResponse;
          const albums = data.albums ?? [];
          cacheSet("alb", s.host, { albums, hasMore: data.hasMore ?? false }, CACHE_TTL.albums);
          return [s.host, albums];
        } catch {
          return [s.host, seeded[s.host] ?? []];
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setAlbumsByHost((prev) => {
        const next = { ...prev };
        for (const [host, albums] of entries) next[host] = albums;
        return next;
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active, yupooStores]);

  const results = useMemo(() => {
    if (!active) return [];
    const words = q.split(/\s+/);
    const out: { album: YupooAlbum; host: string; storeId: string; storeName: string }[] = [];
    for (const s of yupooStores) {
      const albums = albumsByHost[s.host];
      if (!albums) continue;
      for (const album of albums) {
        const title = album.title.toLowerCase();
        if (words.every((w) => title.includes(w))) {
          out.push({ album, host: s.host, storeId: s.id, storeName: s.name });
        }
      }
    }
    return out;
  }, [active, q, yupooStores, albumsByHost]);

  if (!active) return null;

  return (
    <div className="mt-10 border-t border-white/5 pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight text-mist-100">From your followed stores</h2>
        <span className="rounded-none border border-ink-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mist-500">
          live album search
        </span>
        {loading && <Loader2 size={14} aria-hidden="true" className="animate-spin text-mist-400" />}
        <span className="ml-auto text-xs text-mist-500">
          {results.length} match{results.length === 1 ? "" : "es"}
        </span>
      </div>

      {yupooStores.length === 0 ? (
        <p className="rounded-none border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-400">
          Follow some Yupoo stores in your Library to search across their albums here.
        </p>
      ) : results.length === 0 ? (
        <p className="rounded-none border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-400">
          {loading
            ? "Searching your followed stores…"
            : `No albums matching “${query.trim()}” in your ${yupooStores.length} followed store${yupooStores.length === 1 ? "" : "s"}.`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {results.map(({ album, host, storeId, storeName }) => (
            <Link
              key={`${host}:${album.id}`}
              href={`/store/${storeId}?album=${album.id}`}
              className="group overflow-hidden border border-white/5 transition-colors hover:border-white"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink-700">
                {album.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
              <div className="p-2">
                <p className="line-clamp-2 text-xs text-mist-200">{album.title}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-mist-500">
                  <Store size={10} aria-hidden="true" /> {storeName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

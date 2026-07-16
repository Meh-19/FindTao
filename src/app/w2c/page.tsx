"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Images, Loader2, ScanSearch, Store, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { itemStore } from "@/data/catalog";
import type { CatalogItem } from "@/data/catalog";
import { proxiedImg, type YupooAlbum, type YupooAlbumsResponse } from "@/lib/yupoo";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/clientCache";
import { libraryYupooStores, type YupooStoreRef } from "@/lib/yupooStores";
import { imageHash, scoreTitle, type W2CIdentity } from "@/lib/w2c";
import { parsePriceCnyDetailed, type ParsedPrice } from "@/lib/price";
import { formatMoney } from "@/lib/currency";

/** Identifications are cached this long — the same photo never costs a second AI call. */
const IDENTITY_TTL = 30 * 24 * 3600_000;
const CONCURRENCY = 3;
const MAX_BYTES = 5 * 1024 * 1024;

type Stage =
  | { kind: "idle" }
  | { kind: "identifying" }
  | { kind: "done"; identity: W2CIdentity; cached: boolean }
  | { kind: "error"; message: string };

interface AlbumHit {
  album: YupooAlbum;
  store: YupooStoreRef;
  score: number;
  hits: string[];
}

/** data URL → the raw base64 payload + its media type, which is what the API wants. */
function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  return m ? { mediaType: m[1], base64: m[2] } : null;
}

export default function W2CPage() {
  const { allStores, library, catalogItems, hydrated, fmtConverted, toast } = useStore();
  const stores = useMemo(() => libraryYupooStores(allStores, library), [allStores, library]);
  // Key the scrape effect off the hosts, not the array identity — `allStores` is
  // rebuilt whenever the directory refreshes, which would cancel an in-flight pass.
  const storesKey = stores.map((s) => s.host).join(",");

  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [albumsByHost, setAlbumsByHost] = useState<Record<string, YupooAlbum[]>>({});
  const [searching, setSearching] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const identity = stage.kind === "done" ? stage.identity : null;

  const identify = useCallback(
    async (dataUrl: string) => {
      const parts = splitDataUrl(dataUrl);
      if (!parts) {
        setStage({ kind: "error", message: "That file didn't read as an image — try another." });
        return;
      }

      // Re-checking a photo you've already run is free: the identification is
      // keyed by the image itself, so it never re-hits the paid endpoint.
      const key = imageHash(parts.base64);
      const hit = cacheGet<W2CIdentity>("w2c", key);
      if (hit) {
        setStage({ kind: "done", identity: hit, cached: true });
        return;
      }

      setStage({ kind: "identifying" });
      try {
        const res = await fetch("/api/w2c/identify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: parts.base64, mediaType: parts.mediaType }),
        });
        const data = (await res.json()) as W2CIdentity & { error?: string; message?: string };
        if (!res.ok) {
          setStage({ kind: "error", message: data.message ?? "Couldn't identify that photo." });
          return;
        }
        cacheSet<W2CIdentity>("w2c", key, data, IDENTITY_TTL);
        setStage({ kind: "done", identity: data, cached: false });
      } catch {
        setStage({ kind: "error", message: "Couldn't reach the finder — check your connection." });
      }
    },
    [],
  );

  const loadFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        toast("That's not an image file", "error");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast("That photo is over 5MB — try a smaller one", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setPreview(dataUrl);
        identify(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [identify, toast],
  );

  // Paste-to-search — the way people actually move a photo out of Discord.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.items ?? [])]
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (file) loadFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  // Pull the followed stores' album titles once we know what we're looking for.
  useEffect(() => {
    if (!identity || stores.length === 0) return;
    let cancelled = false;
    const todo = stores.filter((s) => !albumsByHost[s.host]);

    const seeded: Record<string, YupooAlbum[]> = {};
    for (const s of todo) {
      const cached = cacheGet<{ albums: YupooAlbum[]; hasMore: boolean }>("alb", s.host);
      if (cached) seeded[s.host] = cached.albums;
    }
    if (Object.keys(seeded).length > 0) setAlbumsByHost((prev) => ({ ...prev, ...seeded }));

    const fetchList = todo.filter((s) => !seeded[s.host]);
    if (fetchList.length === 0) {
      setSearching(false);
      return;
    }

    setSearching(true);
    let cursor = 0;
    async function worker() {
      while (cursor < fetchList.length) {
        const s = fetchList[cursor++];
        try {
          const res = await fetch(`/api/yupoo/albums?host=${encodeURIComponent(s.host)}&page=1`);
          if (!res.ok) continue;
          const data = (await res.json()) as YupooAlbumsResponse;
          const albums = data.albums ?? [];
          cacheSet("alb", s.host, { albums, hasMore: data.hasMore ?? false }, CACHE_TTL.albums);
          if (!cancelled) setAlbumsByHost((prev) => ({ ...prev, [s.host]: albums }));
        } catch {
          /* skip a store that won't load */
        }
      }
    }
    Promise.all(Array.from({ length: Math.min(CONCURRENCY, fetchList.length) }, () => worker())).then(() => {
      if (!cancelled) setSearching(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, storesKey]);

  const albumHits = useMemo<AlbumHit[]>(() => {
    if (!identity) return [];
    const out: AlbumHit[] = [];
    for (const store of stores) {
      for (const album of albumsByHost[store.host] ?? []) {
        const match = scoreTitle(album.title, identity);
        if (match) out.push({ album, store, score: match.score, hits: match.hits });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 24);
  }, [identity, stores, albumsByHost]);

  const catalogHits = useMemo(() => {
    if (!identity) return [];
    const out: { item: CatalogItem; score: number }[] = [];
    for (const item of catalogItems) {
      const match = scoreTitle(`${item.title} ${item.tags.join(" ")}`, identity);
      if (match) out.push({ item, score: match.score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [identity, catalogItems]);

  function reset() {
    setPreview(null);
    setStage({ kind: "idle" });
    if (fileInput.current) fileInput.current.value = "";
  }

  if (!hydrated) return null;

  const totalHits = albumHits.length + catalogHits.length;

  return (
    <div className="fade-up mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <ScanSearch size={26} aria-hidden="true" className="text-neon-300" />
          W2C <span className="flow-text">finder</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Drop in a photo of a piece and this reads what it is, then hunts your followed stores and the catalog for it.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          loadFile(e.dataTransfer.files?.[0]);
        }}
        className="relative mb-5 border border-dashed border-ink-500 bg-ink-800/40 p-5"
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => loadFile(e.target.files?.[0])}
          className="sr-only"
          id="w2c-file"
        />
        {preview ? (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-36 w-36 border border-white/10 object-cover" />
            <div className="min-w-0 flex-1">
              {stage.kind === "identifying" && (
                <p className="flex items-center gap-2 text-sm text-mist-300">
                  <Loader2 size={14} aria-hidden="true" className="animate-spin text-neon-300" />
                  Reading the photo…
                </p>
              )}
              {stage.kind === "error" && (
                <p className="border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{stage.message}</p>
              )}
              {identity && (
                <>
                  <p className="text-base font-bold text-mist-100">
                    {identity.brand ? `${identity.brand} — ` : ""}
                    {identity.category}
                  </p>
                  {identity.notes && <p className="mt-1 text-xs text-mist-400">{identity.notes}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...identity.keywords, ...identity.keywordsZh, ...identity.colors].map((k) => (
                      <span key={k} className="border border-ink-500 px-1.5 py-0.5 text-[10px] text-mist-400">
                        {k}
                      </span>
                    ))}
                  </div>
                  {stage.kind === "done" && stage.cached && (
                    <p className="mt-2 text-[11px] text-success">Read from your saved copy — no AI call used.</p>
                  )}
                </>
              )}
            </div>
            <button
              onClick={reset}
              aria-label="Clear photo"
              className="shrink-0 border border-ink-500 p-1.5 text-mist-500 transition-colors hover:text-danger"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label htmlFor="w2c-file" className="flex cursor-pointer flex-col items-center gap-2 py-8 text-center">
            <Upload size={22} aria-hidden="true" className="text-mist-500" />
            <span className="text-sm font-medium text-mist-200">Drop a photo, paste it, or click to pick one</span>
            <span className="text-xs text-mist-500">
              JPEG / PNG / WebP, up to 5MB · one AI read per photo, then it&apos;s saved
            </span>
          </label>
        )}
      </div>

      {identity && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-mist-100">Possible matches</h2>
            {searching && <Loader2 size={14} aria-hidden="true" className="animate-spin text-mist-400" />}
            <span className="ml-auto text-xs text-mist-500">
              {totalHits} hit{totalHits === 1 ? "" : "s"} across {stores.length} store
              {stores.length === 1 ? "" : "s"}
            </span>
          </div>

          {totalHits === 0 ? (
            <p className="border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-400">
              {searching
                ? "Searching your followed stores…"
                : stores.length === 0
                  ? "Follow some Yupoo stores from Discover and they'll be searched here."
                  : "No listings in your stores match this one. Try a store with a bigger catalog, or search a keyword by hand."}
            </p>
          ) : (
            <>
              {albumHits.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {albumHits.map(({ album, store, hits }) => (
                    <HitCard key={`${store.host}:${album.id}`} album={album} store={store} hits={hits} fmtConverted={fmtConverted} />
                  ))}
                </div>
              )}

              {catalogHits.length > 0 && (
                <div className="mt-8 border-t border-white/5 pt-6">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
                    From the catalog
                  </h3>
                  <div className="space-y-1.5">
                    {catalogHits.map(({ item }) => (
                      <Link
                        key={item.id}
                        href={`/item/${item.id}`}
                        className="flex items-center gap-2 border border-white/5 bg-ink-800/80 px-3 py-2 text-sm transition-colors hover:border-white"
                      >
                        <span className="min-w-0 flex-1 truncate text-mist-100">{item.title}</span>
                        <span className="text-xs text-mist-500">{itemStore(item).name}</span>
                        <span className="tabular-nums text-xs text-mist-300">{formatMoney(item.priceCny, "CNY")}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-mist-500">
            Matches are scored on listing titles, so a seller who titles lazily can still have it — worth a look in{" "}
            <Link href="/browse" className="text-neon-300 hover:text-neon-400">
              Search
            </Link>{" "}
            with the keywords above.
          </p>
        </>
      )}
    </div>
  );
}

function HitCard({
  album,
  store,
  hits,
  fmtConverted,
}: {
  album: YupooAlbum;
  store: YupooStoreRef;
  hits: string[];
  fmtConverted: (cny: number) => string;
}) {
  const cached = cacheGet<{ p: ParsedPrice | null }>("price", `${store.host}:${album.id}`);
  const price = (cached ? cached.p : parsePriceCnyDetailed(album.title))?.value ?? null;

  return (
    <Link
      href={`/store/${store.id}?album=${album.id}`}
      className="group overflow-hidden border border-white/5 bg-ink-800/80 transition-colors hover:border-white"
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
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-mist-500">
          <Store size={10} aria-hidden="true" /> {store.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {price !== null && (
            <span className="text-xs font-semibold tabular-nums text-mist-100">
              {formatMoney(price, "CNY")} <span className="flow-text font-bold">≈ {fmtConverted(price)}</span>
            </span>
          )}
        </div>
        {/* Why this matched — the difference between a hunch and a lead. */}
        <p className="mt-1 line-clamp-1 text-[10px] text-neon-300" title={hits.join(", ")}>
          {hits.join(" · ")}
        </p>
      </div>
    </Link>
  );
}

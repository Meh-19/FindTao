"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Images, Link2, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { proxiedImg, isValidYupooHost } from "@/lib/yupoo";

export interface ChartSelection {
  host: string;
  storeId: string | null;
  storeName: string;
  /** Raw (unproxied) photo.yupoo.com URL — what analyze-chart actually fetches. */
  photoUrl: string;
}

/** `https://firerep.x.yupoo.com/albums/242172013?uid=1` → { host, albumId }. Trailing path/query ignored. */
function parseYupooAlbumUrl(raw: string): { host: string; albumId: string } | null {
  const m = raw.trim().match(/^(?:https?:\/\/)?([a-z0-9-]+)\.x\.yupoo\.com\/albums\/(\d+)/i);
  if (!m || !isValidYupooHost(m[1])) return null;
  return { host: m[1].toLowerCase(), albumId: m[2] };
}

/**
 * Store → album → photo picker for the AI Advisor: the shopper points at
 * whichever photo in the album is the size chart, and that's what gets sent
 * to the chart-reading API. Two entry paths: pick a Yupoo store already in
 * the library, or paste any Yupoo album URL directly (matches how the user
 * would just copy it from the album they're already looking at).
 */
export function ChartPicker({ onPick }: { onPick: (selection: ChartSelection) => void }) {
  const { allStores, library } = useStore();
  const libraryYupooStores = useMemo(
    () => allStores.filter((s) => library.includes(s.id) && /\.x\.yupoo\.com/i.test(s.url)),
    [allStores, library],
  );

  const [pastedUrl, setPastedUrl] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [target, setTarget] = useState<{ host: string; albumId: string; storeId: string | null; storeName: string } | null>(null);
  const [albumUrlInput, setAlbumUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function useLibraryStore() {
    setError(null);
    const store = libraryYupooStores.find((s) => s.id === selectedStoreId);
    if (!store) {
      setError("Pick a store first");
      return;
    }
    const parsed = parseYupooAlbumUrl(albumUrlInput) ?? null;
    if (!parsed) {
      setError("Paste the album URL from that store's Yupoo page (the one with /albums/12345 in it)");
      return;
    }
    setTarget({ host: parsed.host, albumId: parsed.albumId, storeId: store.id, storeName: store.name });
  }

  function usePastedUrl() {
    setError(null);
    const parsed = parseYupooAlbumUrl(pastedUrl);
    if (!parsed) {
      setError("That doesn't look like a Yupoo album URL — it should look like https://storename.x.yupoo.com/albums/12345");
      return;
    }
    const known = allStores.find((s) => s.url.toLowerCase().includes(`${parsed.host}.x.yupoo.com`));
    setTarget({ host: parsed.host, albumId: parsed.albumId, storeId: known?.id ?? null, storeName: known?.name ?? parsed.host });
  }

  if (!target) {
    return (
      <div className="space-y-4">
        {libraryYupooStores.length > 0 && (
          <div className="border border-white/5 bg-ink-800/80 p-4">
            <p className="text-sm font-semibold text-mist-100">From your library</p>
            <p className="mt-0.5 text-xs text-mist-500">
              Pick a store you follow, then paste the specific album URL that has the size chart.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 outline-none focus:border-neon-500 sm:w-48"
              >
                <option value="">Choose a store</option>
                {libraryYupooStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                value={albumUrlInput}
                onChange={(e) => setAlbumUrlInput(e.target.value)}
                placeholder="https://storename.x.yupoo.com/albums/12345"
                className="flex-1 rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
              />
              <button onClick={useLibraryStore} className="btn-glow flex items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white">
                Load album
              </button>
            </div>
          </div>
        )}

        <div className="border border-white/5 bg-ink-800/80 p-4">
          <p className="text-sm font-semibold text-mist-100">Or paste any album URL</p>
          <p className="mt-0.5 text-xs text-mist-500">Works for any Yupoo store, in your library or not.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="https://firerep.x.yupoo.com/albums/242172013"
              className="flex-1 rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
            />
            <button onClick={usePastedUrl} className="btn-glow flex items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-sm font-semibold text-white">
              <Link2 size={14} aria-hidden="true" /> Load album
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-mist-300">
          Tap the photo that shows the <span className="font-semibold text-mist-100">size chart</span>
        </p>
        <button onClick={() => setTarget(null)} className="text-xs text-mist-500 underline decoration-ink-500 hover:text-mist-300">
          Choose a different album
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

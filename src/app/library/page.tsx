"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { StoreCard } from "@/components/StoreCard";
import { useStore } from "@/lib/store";
import { parseLink } from "@/lib/links";
import { detectStorePlatform } from "@/lib/platform";
import type { StoreInfo } from "@/data/stores";

const PALETTE: [string, string][] = [
  ["#8b5cf6", "#22d3ee"],
  ["#ec4899", "#f59e0b"],
  ["#10b981", "#3b82f6"],
  ["#f43f5e", "#8b5cf6"],
];

export default function LibraryPage() {
  const { allStores, library, favStores, submitStore, toast, hydrated } = useStore();
  const [favOnly, setFavOnly] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const stores = useMemo(() => {
    const saved = allStores.filter((s) => library.includes(s.id));
    return favOnly ? saved.filter((s) => favStores.includes(s.id)) : saved;
  }, [allStores, library, favStores, favOnly]);

  function addByUrl() {
    const trimmedUrl = url.trim();
    const info = detectStorePlatform(trimmedUrl);
    // Yupoo subdomains make a decent default name when none is given.
    const trimmedName = name.trim() || info.yupooHost || "";
    if (!trimmedName || !trimmedUrl) {
      toast("Give the store a name and a URL", "error");
      return;
    }
    const parsed = parseLink(trimmedUrl);
    if (info.platform === "other" && !parsed && !/^(https?:\/\/)?[\w.-]+\.\w{2,}/.test(trimmedUrl)) {
      toast("Paste a Yupoo, Taobao, or Weidian store link", "error");
      return;
    }
    const id = `user-${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    const store: StoreInfo = {
      id,
      name: trimmedName,
      url: trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`,
      categories: ["Clothing"],
      hue: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      trust: 50,
      blurb: "Added by you — trust builds as data comes in.",
      albums: 0,
      community: true,
    };
    submitStore(store);
    setUrl("");
    setName("");
    toast(
      info.platform === "yupoo"
        ? `${trimmedName} added — albums load right on the store page`
        : info.platform === "other"
          ? `${trimmedName} added to your library`
          : `${trimmedName} added — it opens on ${info.label} from the store page`,
    );
  }

  if (!hydrated) return null;

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Your <span className="flow-text">library</span>
          </h1>
          <p className="mt-1 text-sm text-mist-400">
            Stores you follow. Favorites get a star and a filter.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-none border border-ink-500 px-3 py-1.5 text-sm text-mist-300 transition-colors has-checked:border-warning/60 has-checked:bg-warning/10 has-checked:text-warning">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="accent-warning" />
          <Star size={13} aria-hidden="true" className={favOnly ? "fill-current" : ""} /> Favorites only
        </label>
      </div>

      <div className="mb-8 rounded-none border border-white/5 bg-ink-800/60 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-mist-500">
          Add a store by URL
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Store name"
            className="rounded-none border border-ink-500 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500 sm:w-48"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="weidian.com/?userid=… or a Yupoo album URL"
            className="flex-1 rounded-none border border-ink-500 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
          />
          <button onClick={addByUrl} className="btn-glow rounded-none px-5 py-2.5 text-sm font-semibold text-white">
            Add store
          </button>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          {favOnly ? "No favorites yet — star a store to pin it here." : (
            <>Library is empty. <Link href="/discover" className="text-neon-300 underline">Discover stores</Link> to add some.</>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s, i) => (
            <StoreCard key={s.id} store={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

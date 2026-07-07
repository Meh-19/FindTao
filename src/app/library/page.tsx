"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { StoreCard } from "@/components/StoreCard";
import { useStore } from "@/lib/store";
import { parseLink } from "@/lib/links";
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
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      toast("Give the store a name and a URL", "error");
      return;
    }
    const parsed = parseLink(trimmedUrl);
    const isYupoo = /yupoo\.com/i.test(trimmedUrl);
    if (!parsed && !isYupoo && !/^(https?:\/\/)?[\w.-]+\.\w{2,}/.test(trimmedUrl)) {
      toast("That doesn't look like a valid store URL", "error");
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
    toast(`${trimmedName} added to your library`);
  }

  if (!hydrated) return null;

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Your <span className="flow-text">library</span>
          </h1>
          <p className="mt-1 text-sm text-mist-400">
            Stores you follow. Favorites get a star and a filter.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-500 px-3 py-1.5 text-sm text-mist-300 transition-colors has-checked:border-amber-400/60 has-checked:bg-amber-400/10 has-checked:text-amber-300">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="accent-amber-400" />
          <Star size={13} aria-hidden="true" className={favOnly ? "fill-current" : ""} /> Favorites only
        </label>
      </div>

      <div className="mb-8 rounded-2xl border border-white/5 bg-ink-800/60 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-mist-500">
          Add a store by URL
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Store name"
            className="rounded-xl border border-ink-500 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500 sm:w-48"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="weidian.com/?userid=… or a Yupoo album URL"
            className="flex-1 rounded-xl border border-ink-500 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
          />
          <button onClick={addByUrl} className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
            Add store
          </button>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
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

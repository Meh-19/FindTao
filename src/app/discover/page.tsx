"use client";

import { useMemo, useState } from "react";
import { StoreCard } from "@/components/StoreCard";
import { STORE_CATEGORIES } from "@/data/stores";
import type { StoreCategory } from "@/data/stores";
import { useStore } from "@/lib/store";

export default function DiscoverPage() {
  const { directory, hydrated } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoreCategory | "all">("all");

  const visible = useMemo(
    () => directory.filter((s) => s.discover !== false && !s.banned),
    [directory],
  );

  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter((s) => {
      if (category !== "all" && !s.categories.includes(category)) return false;
      if (!q) return true;
      return `${s.name} ${s.blurb} ${s.categories.join(" ")} ${(s.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [visible, query, category]);

  if (!hydrated) return null;

  return (
    <div className="fade-up">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Community <span className="flow-text">stores</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          {visible.length} store{visible.length === 1 ? "" : "s"} in the directory — add the good
          ones to your library. Submit your own from the Library page.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stores…"
          className="w-full rounded-xl border border-ink-500 bg-ink-800/80 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STORE_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c as StoreCategory | "all")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? "border-neon-500/60 bg-neon-600/20 text-neon-300"
                  : "border-ink-500 text-mist-400 hover:text-mist-100"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-500 py-16 text-center text-sm text-mist-400">
          No stores match. Try another category or search term.
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

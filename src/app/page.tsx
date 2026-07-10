"use client";

import Link from "next/link";
import { ArrowRight, Globe, Link2, Search, ShoppingBasket, Sparkles } from "lucide-react";
import { storeAlbums } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { ItemCard } from "@/components/ItemCard";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";

const ACTIONS = [
  { href: "/browse", Icon: Search, title: "Search finds", blurb: "Keyword search with QC, trust, and price filters." },
  { href: "/convert", Icon: Link2, title: "Convert a link", blurb: "Any marketplace or agent link → every agent's version." },
  { href: "/hauls", Icon: ShoppingBasket, title: "Plan a haul", blurb: "Group items, set budgets, export agent links in bulk." },
  { href: "/discover", Icon: Globe, title: "Discover stores", blurb: "Community directory — add stores to your library." },
];

export default function HomePage() {
  const { library, hydrated, directory, allStores, catalogItems } = useStore();
  const featured = catalogItems.slice(0, 4);
  const visibleStores = directory.filter((s) => s.discover !== false && !s.banned);
  const communityStores = visibleStores.slice(0, 8);
  const savedCount = hydrated ? allStores.filter((s) => library.includes(s.id)).length : 0;

  return (
    <div>
      <section className="fade-up mb-12 pt-4 text-center md:pt-10">
        <span className="inline-flex items-center gap-1.5 rounded-none border border-neon-500/30 bg-neon-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-neon-300">
          <Sparkles size={12} aria-hidden="true" /> Personal find browser
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Find the pieces.
          <br />
          <span className="flow-text">Hand off the haul.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-mist-400 md:text-base">
          Browse Taobao, Weidian, 1688 and Xianyu finds from anywhere — organize stores, plan
          hauls, and send everything to your agent in one click.
        </p>
        <div className="mt-6 flex items-center justify-center gap-10 text-center">
          {[
            { n: visibleStores.length, label: "community stores" },
            { n: savedCount, label: "stores in library" },
            { n: ACTIVE_AGENTS.length, label: "agents supported" },
          ].map(({ n, label }) => (
            <div key={label}>
              <p className="flow-text text-2xl font-extrabold">{n}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-mist-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map(({ href, Icon, title, blurb }, i) => (
          <Link
            key={href}
            href={href}
            className="card-pop fade-up rounded-none border border-white/5 bg-ink-800/80 p-5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="flow-bg inline-flex h-9 w-9 items-center justify-center rounded-none text-white shadow-hard-sm">
              <Icon size={17} aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-mist-100">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-mist-500">{blurb}</p>
          </Link>
        ))}
      </section>

      {featured.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold">Featured finds</h2>
            <Link href="/browse" className="inline-flex items-center gap-1 text-xs text-neon-300 hover:text-neon-400">
              See all <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">New from the community</h2>
          <Link href="/discover" className="inline-flex items-center gap-1 text-xs text-neon-300 hover:text-neon-400">
            Discover more <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
        {communityStores.length === 0 && (
          <p className="rounded-none border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-500">
            The community directory is filling up — check back soon, or add your own store from the Library page.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {communityStores.map((s, i) => (
            <Link
              key={s.id}
              href={`/store/${s.id}`}
              className="card-pop fade-up flex items-center gap-3 rounded-none border border-white/5 bg-ink-800/80 p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none text-[11px] font-bold text-white shadow"
                style={{ background: "#1a1a1a" }}
              >
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-mist-100">{s.name}</span>
                <span className="block truncate text-xs text-mist-500">
                  {/* BUG FIX: s.albums was always 0 (unset directory field) — read the real album list length instead. */}
                  {detectStorePlatform(s.url).platform === "yupoo" ? "Live on Yupoo" : `${storeAlbums(s).length} albums`}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

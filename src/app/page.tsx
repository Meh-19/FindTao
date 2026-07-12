"use client";

import Link from "next/link";
import { ArrowRight, Globe, Link2, Search, ShoppingBasket, Sparkles } from "lucide-react";
import { storeAlbums } from "@/data/albums";
import { detectStorePlatform } from "@/lib/platform";
import { ItemCard } from "@/components/ItemCard";
import { StoreAvatar } from "@/components/StoreAvatar";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";

const ACTIONS = [
  { href: "/browse", Icon: Search, title: "Search finds", blurb: "Keyword search with QC, trust, and price filters." },
  { href: "/convert", Icon: Link2, title: "Convert a link", blurb: "Any marketplace or agent link → every agent's version." },
  { href: "/hauls", Icon: ShoppingBasket, title: "Plan a haul", blurb: "Group items, set budgets, export agent links in bulk." },
  { href: "/discover", Icon: Globe, title: "Discover stores", blurb: "Community directory — add stores to your library." },
];

function SectionHead({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <Link href={href} className="flow-text inline-flex items-center gap-1 text-xs font-medium hover:opacity-80">
        {cta} <ArrowRight size={12} aria-hidden />
      </Link>
    </div>
  );
}

export default function HomePage() {
  const { library, hydrated, directory, allStores, catalogItems } = useStore();
  const featured = catalogItems.slice(0, 4);
  const visibleStores = directory.filter((s) => s.discover !== false && !s.banned);
  const communityStores = visibleStores.slice(0, 8);
  const savedCount = hydrated ? allStores.filter((s) => library.includes(s.id)).length : 0;

  const stats = [
    { n: visibleStores.length, label: "community stores" },
    { n: savedCount, label: "stores in library" },
    { n: ACTIVE_AGENTS.length, label: "agents supported" },
  ];

  return (
    <div className="fade-up">
      <section className="mb-16 pt-4 text-center md:pt-10">
        <span className="inline-flex items-center gap-1.5 border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-mist-300">
          <Sparkles size={12} aria-hidden /> Personal find browser
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Find the pieces.
          <br />
          <span className="flow-text">Hand off the haul.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-mist-400">
          Browse Taobao, Weidian, 1688 and Xianyu finds from anywhere — organize stores, plan hauls,
          and send everything to your agent in one click.
        </p>
        <dl className="mt-8 flex items-center justify-center gap-10">
          {stats.map(({ n, label }) => (
            <div key={label} className="flex flex-col-reverse items-center">
              <dt className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-mist-500">{label}</dt>
              <dd className="flow-text font-mono text-3xl font-bold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ul className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map(({ href, Icon, title, blurb }) => (
          <li key={href}>
            <Link href={href} className="card-pop flex h-full flex-col border border-white/5 bg-ink-800 p-5">
              <span className="flow-bg mb-3 inline-flex h-9 w-9 items-center justify-center text-[var(--acc-ink)] shadow-hard-sm">
                <Icon size={17} aria-hidden />
              </span>
              <h3 className="font-display text-sm font-semibold text-mist-100">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-mist-500">{blurb}</p>
            </Link>
          </li>
        ))}
      </ul>

      {featured.length > 0 && (
        <section className="mb-16">
          <SectionHead title="Featured finds" href="/browse" cta="See all" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="New from the community" href="/discover" cta="Discover more" />
        {communityStores.length === 0 ? (
          <p className="border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-500">
            The community directory is filling up — check back soon, or add your own store from the Library page.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {communityStores.map((s) => (
              <li key={s.id}>
                <Link href={`/store/${s.id}`} className="card-pop flex items-center gap-3 border border-white/5 bg-ink-800 p-4">
                  <StoreAvatar store={s} className="h-10 w-10 text-[11px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-mist-100">{s.name}</span>
                    <span className="block truncate text-xs text-mist-500">
                      {/* Real album list length — s.albums is an unset directory field (always 0). */}
                      {detectStorePlatform(s.url).platform === "yupoo" ? "Live on Yupoo" : `${storeAlbums(s).length} albums`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

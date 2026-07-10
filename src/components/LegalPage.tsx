import type { ReactNode } from "react";

/**
 * Shared shell + typography for the static legal pages (/privacy, /terms).
 * Server component — these pages are pure prose with no client state.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="fade-up mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight">
        {title.split(" ").slice(0, -1).join(" ")} <span className="flow-text">{title.split(" ").slice(-1)}</span>
      </h1>
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-mist-500">Last updated {updated}</p>

      <div className="mt-6 space-y-3 text-sm leading-relaxed text-mist-300">{intro}</div>

      <div className="mt-8 space-y-8">{children}</div>
    </article>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-mist-100">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-mist-300">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-mist-600">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

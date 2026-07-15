"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Ruler, Shirt, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { cmToIn, kgToLb } from "@/lib/measurements";
import { buildFitExport, decodeFit, encodeFit, fitToMarkdown, type FitExport } from "@/lib/fitExport";
import { CopyButton } from "@/components/CopyButton";
import { StarRating } from "@/components/StarRating";

function measureText(mm: FitExport["measures"][number]): string {
  if (mm.kind === "wt") return `${mm.value.toFixed(1)} kg · ${kgToLb(mm.value).toFixed(0)} lb`;
  return `${mm.value.toFixed(1)} cm · ${cmToIn(mm.value).toFixed(1)} in`;
}

export default function FitExportPage() {
  const { measurements, cart, hauls, collection, hydrated } = useStore();
  // "snapshot" = opened from a shared link; "live" = the owner building their own.
  const [mode, setMode] = useState<"loading" | "snapshot" | "invalid" | "live">("loading");
  const [snapshot, setSnapshot] = useState<FitExport | null>(null);

  useEffect(() => {
    const m = window.location.hash.match(/d=([^&]+)/);
    if (m) {
      const d = decodeFit(decodeURIComponent(m[1]));
      setSnapshot(d);
      setMode(d ? "snapshot" : "invalid");
    } else {
      setMode("live");
    }
  }, []);

  const live = useMemo(
    () => (hydrated ? buildFitExport(measurements, cart, hauls, collection) : null),
    [hydrated, measurements, cart, hauls, collection],
  );

  const data = mode === "snapshot" ? snapshot : live;
  const isOwner = mode === "live";

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !data) return "";
    if (mode === "snapshot") return window.location.href;
    return `${window.location.origin}/fit#d=${encodeFit(data)}`;
  }, [data, mode]);

  if (mode === "loading" || (mode === "live" && !hydrated)) return null;

  if (mode === "invalid" || !data) {
    return (
      <div className="fade-up mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-mist-400">
          This fit link is empty or unreadable.{" "}
          <Link href="/advisor" className="text-neon-300 hover:text-neon-400">
            Generate one from the AI Advisor →
          </Link>
        </p>
      </div>
    );
  }

  const hasAnything = data.measures.length > 0 || data.sized.length > 0 || data.owned.length > 0;

  return (
    <div className="fade-up mx-auto max-w-2xl py-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <Bot size={26} aria-hidden="true" className="text-neon-300" />
          Fit profile <span className="flow-text">for AI</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          {isOwner
            ? "A shareable snapshot of your measurements, advised sizes, and well-fitting pieces. Hand the link (or the copied text) to an AI and ask what size to get."
            : "A shopper's measurements, advised sizes, and well-fitting pieces — use these to recommend what size they should get."}
        </p>
      </div>

      {/* Toolbar: the two ways to feed this to an AI. */}
      <div className="mb-5 flex flex-col gap-2 border border-white/10 bg-ink-800/80 p-4 sm:flex-row sm:items-center">
        <p className="flex items-center gap-1.5 text-xs text-mist-400 sm:flex-1">
          <Sparkles size={13} aria-hidden="true" className="text-neon-300" />
          Paste the link to an AI that can open pages, or copy the summary and paste it straight into any chat.
        </p>
        <div className="flex gap-2">
          <CopyButton text={fitToMarkdown(data)} label="Copy for AI" className="px-4 py-2" />
          {shareUrl && <CopyButton text={shareUrl} label="Copy link" className="px-4 py-2" />}
        </div>
      </div>

      {isOwner && (
        <p className="mb-5 border border-warning/30 bg-warning/5 px-4 py-2.5 text-[11px] text-warning">
          Heads up — the link embeds your measurements. Only share it with an AI or person you trust.
        </p>
      )}

      {!hasAnything ? (
        <div className="border border-dashed border-ink-500 px-4 py-12 text-center text-sm text-mist-400">
          Nothing to export yet — add your measurements in the{" "}
          <Link href="/advisor" className="text-neon-300 hover:text-neon-400">
            AI Advisor
          </Link>{" "}
          and size some items first.
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
              <Ruler size={14} aria-hidden="true" /> Measurements
              <span className="font-normal normal-case tracking-normal text-mist-500">· {data.fit} fit</span>
            </h2>
            {data.measures.length === 0 ? (
              <p className="text-sm text-mist-400">No measurements on file.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.measures.map((mm) => (
                  <div key={mm.label} className="border border-white/5 bg-ink-800/80 px-3 py-2">
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-mist-500">
                      {mm.label}
                      {!mm.measured && <span className="font-mono text-[9px] text-mist-500">est.</span>}
                    </p>
                    <p className="text-sm tabular-nums text-mist-100">{measureText(mm)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {data.sized.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
                <Shirt size={14} aria-hidden="true" /> Sizes advised / chosen ({data.sized.length})
              </h2>
              <div className="space-y-1.5">
                {data.sized.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-white/5 bg-ink-800/80 px-3 py-2 text-sm">
                    <span className="font-medium text-mist-100">{s.title}</span>
                    <span className="text-xs text-mist-500">{s.store} · {s.garment}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {s.size && (
                        <span className="border border-neon-400/30 bg-neon-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neon-300">
                          AI {s.size}
                        </span>
                      )}
                      {s.chosen && (
                        <span className="border border-mist-300/40 bg-mist-100/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-mist-100">
                          Mine {s.chosen}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.owned.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
                <Shirt size={14} aria-hidden="true" /> Owned &amp; how it fits ({data.owned.length})
              </h2>
              <div className="space-y-1.5">
                {data.owned.map((o, i) => (
                  <div key={i} className="border border-white/5 bg-ink-800/80 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-mist-100">{o.title}</span>
                      <span className="text-xs text-mist-500">{o.store}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {o.size && (
                          <span className="border border-mist-300/40 bg-mist-100/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-mist-100">
                            {o.size}
                          </span>
                        )}
                        {o.rating > 0 && <StarRating value={o.rating} size={12} />}
                      </span>
                    </div>
                    {o.review && <p className="mt-1 text-xs text-mist-300">{o.review}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {isOwner && (
        <p className="mt-6 text-center text-xs text-mist-500">
          <Link href="/advisor" className="text-neon-300 hover:text-neon-400">
            ← Back to the AI Advisor
          </Link>
        </p>
      )}
    </div>
  );
}

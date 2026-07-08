"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImageOff, Pencil, Plus, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney } from "@/lib/currency";
import { parseLink, toAgentUrl } from "@/lib/links";
import { getAgent, DEFAULT_AGENT_ID } from "@/lib/agents";
import { proxiedImg } from "@/lib/yupoo";
import { useStore, type Haul } from "@/lib/store";

/** Rough per-unit parcel weight until real item data exists. */
const EST_UNIT_WEIGHT_G = 600;

function HaulCard({ haul, focused }: { haul: Haul; focused: boolean }) {
  const {
    prefs, setPrefs, renameHaul, deleteHaul, setHaulBudget, removeFromHaul,
    fmtConverted, toast, applyRef,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(haul.name);

  const agent = getAgent(prefs.agentId) ?? getAgent(DEFAULT_AGENT_ID)!;
  const items = haul.items;
  const unitCount = items.reduce((sum, i) => sum + i.qty, 0);
  const totalCny = items.reduce((sum, i) => sum + (i.priceCny ?? 0) * i.qty, 0);
  const unpricedCount = items.filter((i) => i.priceCny === null).length;
  const totalWeight = unitCount * EST_UNIT_WEIGHT_G;
  const active = prefs.activeHaulId === haul.id;
  const overBudget = haul.budgetCny !== null && totalCny > haul.budgetCny;
  const budgetPct = haul.budgetCny ? Math.min((totalCny / haul.budgetCny) * 100, 100) : 0;

  const exportText = items
    .map((i) => {
      const parsed = i.url ? parseLink(i.url) : null;
      const link = parsed ? (applyRef(toAgentUrl(parsed, agent), agent.id) ?? i.url) : i.url;
      return `${i.title}${i.qty > 1 ? ` ×${i.qty}` : ""}${link ? `\n${link}` : ""}`;
    })
    .join("\n\n");

  function saveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== haul.name) renameHaul(haul.id, trimmed);
    setEditing(false);
  }

  return (
    <div
      id={`haul-${haul.id}`}
      className={`card-pop fade-up overflow-hidden rounded-2xl border bg-ink-800/80 scroll-mt-20 ${
        active ? "border-neon-500/50" : "border-white/5"
      } ${focused ? "ring-2 ring-neon-400/60" : ""}`}
    >
      {active && <div className="flow-bg h-0.5" />}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="rounded-lg border border-neon-500 bg-ink-900 px-2 py-1 text-sm font-semibold text-mist-100 outline-none"
            />
          ) : (
            <h2 className="text-base font-bold text-mist-100">{haul.name}</h2>
          )}
          <button onClick={() => setEditing(true)} aria-label="Rename haul" className="p-0.5 text-mist-500 hover:text-neon-300">
            <Pencil size={13} aria-hidden="true" />
          </button>
          {active ? (
            <span className="rounded-full border border-neon-400/30 bg-neon-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon-300">
              Active
            </span>
          ) : (
            <button
              onClick={() => { setPrefs({ activeHaulId: haul.id }); toast(`${haul.name} is now the active haul`); }}
              className="rounded-full border border-ink-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mist-500 hover:text-neon-300"
            >
              Set active
            </button>
          )}
          <button
            onClick={() => { deleteHaul(haul.id); toast(`${haul.name} deleted`, "info"); }}
            className="ml-auto text-xs text-mist-500 transition-colors hover:text-red-400"
          >
            Delete
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mist-400">
          <span>
            {unitCount} item{unitCount === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-mist-100">{formatMoney(totalCny, "CNY")}</span>{" "}
            <span className="flow-text font-bold">≈ {fmtConverted(totalCny)}</span>
            {unpricedCount > 0 && (
              <span className="text-mist-500"> +{unpricedCount} unpriced</span>
            )}
          </span>
          <span>~{(totalWeight / 1000).toFixed(1)} kg est.</span>
          <label className="ml-auto flex items-center gap-1.5">
            Budget ¥
            <input
              type="number"
              min={0}
              value={haul.budgetCny ?? ""}
              placeholder="—"
              onChange={(e) => setHaulBudget(haul.id, e.target.value === "" ? null : Number(e.target.value))}
              className="w-20 rounded-lg border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-mist-100 outline-none focus:border-neon-500"
            />
          </label>
        </div>

        {haul.budgetCny !== null && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
              <div
                className={overBudget ? "h-full bg-red-500" : "flow-bg h-full"}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className={`mt-1 text-[11px] ${overBudget ? "text-red-400" : "text-mist-500"}`}>
              {overBudget
                ? `Over budget by ${formatMoney(totalCny - haul.budgetCny, "CNY")}`
                : `${formatMoney(haul.budgetCny - totalCny, "CNY")} left of ${formatMoney(haul.budgetCny, "CNY")}`}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-900/60 p-2">
                {item.image && item.imgHost ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxiedImg(item.image, item.imgHost)}
                    alt=""
                    loading="lazy"
                    className="h-10 w-12 shrink-0 rounded-lg border border-white/5 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-700 text-mist-500">
                    <ImageOff size={13} aria-hidden="true" />
                  </span>
                )}
                <p className="line-clamp-1 min-w-0 flex-1 text-xs font-medium text-mist-100" title={item.title}>
                  {item.title}
                </p>
                {item.qty > 1 && (
                  <span className="rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">
                    ×{item.qty}
                  </span>
                )}
                <span className="text-[11px] tabular-nums text-mist-500">
                  {item.priceCny !== null ? formatMoney(item.priceCny * item.qty, "CNY") : "—"}
                </span>
                <button
                  onClick={() => removeFromHaul(haul.id, item.id)}
                  aria-label="Remove from haul"
                  className="rounded px-1.5 py-1 text-mist-500 hover:text-red-400"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <CopyButton text={exportText} label={`Copy ${items.length} ${agent.name} links`} className="mt-1 w-full py-2" />
          </div>
        )}
      </div>
    </div>
  );
}

function HaulsView() {
  const { hauls, createHaul, toast, hydrated } = useStore();
  const [newName, setNewName] = useState("");
  const focus = useSearchParams().get("focus");
  const [focused, setFocused] = useState<string | null>(null);

  // Sidebar haul links land here as /hauls?focus=<id> — scroll to that haul
  // and highlight it briefly.
  useEffect(() => {
    if (!hydrated || !focus) return;
    setFocused(focus);
    const el = document.getElementById(`haul-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setFocused(null), 2000);
    return () => clearTimeout(timer);
  }, [hydrated, focus]);

  if (!hydrated) return null;

  function add() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createHaul(trimmed);
    setNewName("");
    toast(`${trimmed} created and set active`);
  }

  return (
    <div className="fade-up">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Your <span className="flow-text">hauls</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Group finds, set budgets, and export agent links per haul. Cart items land in the active
          haul.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New haul name — e.g. Summer fits"
          className="flex-1 rounded-xl border border-ink-500 bg-ink-800/80 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500 sm:max-w-sm"
        />
        <button onClick={add} className="btn-glow flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
          <Plus size={14} aria-hidden="true" /> Create haul
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {hauls.map((h) => (
          <HaulCard key={h.id} haul={h} focused={focused === h.id} />
        ))}
      </div>
    </div>
  );
}

export default function HaulsPage() {
  return (
    <Suspense>
      <HaulsView />
    </Suspense>
  );
}

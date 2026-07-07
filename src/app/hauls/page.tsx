"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { getItem, itemLink, CATEGORY_WEIGHT_G } from "@/data/catalog";
import { Thumb } from "@/components/Thumb";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney } from "@/lib/currency";
import { toAgentUrl } from "@/lib/links";
import { getAgent, DEFAULT_AGENT_ID } from "@/lib/agents";
import { useStore, type Haul } from "@/lib/store";

function HaulCard({ haul }: { haul: Haul }) {
  const {
    prefs, setPrefs, renameHaul, deleteHaul, setHaulBudget, removeFromHaul,
    fmtConverted, toast,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(haul.name);

  const agent = getAgent(prefs.agentId) ?? getAgent(DEFAULT_AGENT_ID)!;
  const items = haul.items.map(getItem).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const totalCny = items.reduce((sum, i) => sum + i.priceCny, 0);
  const totalWeight = items.reduce((sum, i) => sum + CATEGORY_WEIGHT_G[i.category], 0);
  const active = prefs.activeHaulId === haul.id;
  const overBudget = haul.budgetCny !== null && totalCny > haul.budgetCny;
  const budgetPct = haul.budgetCny ? Math.min((totalCny / haul.budgetCny) * 100, 100) : 0;

  const exportText = items
    .map((i) => `${i.title}\n${toAgentUrl(itemLink(i), agent) ?? itemLink(i).rawUrl}`)
    .join("\n\n");

  function saveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== haul.name) renameHaul(haul.id, trimmed);
    setEditing(false);
  }

  return (
    <div className={`card-pop fade-up overflow-hidden rounded-2xl border bg-ink-800/80 ${active ? "border-neon-500/50" : "border-white/5"}`}>
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
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-mist-100">{formatMoney(totalCny, "CNY")}</span>{" "}
            <span className="flow-text font-bold">≈ {fmtConverted(totalCny)}</span>
          </span>
          <span>~{(totalWeight / 1000).toFixed(1)} kg</span>
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
                <Thumb item={item} className="h-10 w-12 shrink-0 rounded-lg" label={false} />
                <Link href={`/item/${item.id}`} className="line-clamp-1 min-w-0 flex-1 text-xs font-medium text-mist-100 hover:underline">
                  {item.title}
                </Link>
                <span className="text-[11px] text-mist-500">{formatMoney(item.priceCny, "CNY")}</span>
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

export default function HaulsPage() {
  const { hauls, createHaul, toast, hydrated } = useStore();
  const [newName, setNewName] = useState("");

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
          <HaulCard key={h.id} haul={h} />
        ))}
      </div>
    </div>
  );
}

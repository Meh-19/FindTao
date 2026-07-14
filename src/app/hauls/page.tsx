"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown, ExternalLink, Globe, ImageOff, Lock, Pencil, Plus, Ruler, Share2, X,
} from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { AdviceBadge, ManualSizeBadge } from "@/components/AdviceBadge";
import { AdviceDetail } from "@/components/AdviceDetail";
import { CopyButton } from "@/components/CopyButton";
import { HaulPreview } from "@/components/HaulPreview";
import { ItemLink } from "@/components/ItemLink";
import { SharePicker } from "@/components/SharePicker";
import { formatMoney } from "@/lib/currency";
import { parseLink, toAgentUrl } from "@/lib/links";
import { getAgent, DEFAULT_AGENT_ID } from "@/lib/agents";
import { proxiedImg } from "@/lib/yupoo";
import { useStore, haulStats, shareableStores, HAUL_UNIT_WEIGHT_G, type Haul, type SavedItem } from "@/lib/store";

/** Editor for the manually chosen size, kept independent of the AI advice. */
function ManualSizeEditor({ item }: { item: SavedItem }) {
  const { setItemSize } = useStore();
  const [draft, setDraft] = useState(item.manualSize ?? "");
  // Reflect changes made elsewhere (e.g. a fresh advisor run) into the field.
  useEffect(() => setDraft(item.manualSize ?? ""), [item.manualSize]);

  const aiSize = item.advice?.size;
  const save = () => setItemSize(item.id, draft.trim() || null);

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-mist-500">Your size</p>
      <p className="mt-0.5 text-[11px] text-mist-500">
        Set what you&apos;ll actually order — your AI size call is kept below either way.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={aiSize ? `e.g. ${aiSize}` : "e.g. L"}
          className="w-24 rounded-none border border-ink-500 bg-ink-900 px-2.5 py-1.5 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
        />
        <button
          onClick={save}
          className="btn-glow rounded-none px-3 py-1.5 text-xs font-semibold text-white"
        >
          Save size
        </button>
        {item.manualSize && (
          <button
            onClick={() => setItemSize(item.id, null)}
            className="border border-ink-500 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:border-danger/40 hover:text-danger"
          >
            Clear
          </button>
        )}
        {aiSize && item.manualSize !== aiSize && (
          <button
            onClick={() => setItemSize(item.id, aiSize)}
            className="text-xs text-neon-300 underline decoration-neon-500/40 underline-offset-2 hover:text-neon-200"
          >
            Use AI size ({aiSize})
          </button>
        )}
      </div>
    </div>
  );
}

/** One haul line — expandable to set a manual size and review the saved AI size call (see AdviceDetail). */
function HaulItem({ item, haulId }: { item: SavedItem; haulId: string }) {
  const { removeFromHaul, measurements } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-none border border-white/5 bg-ink-900/60">
      <div className="flex items-center gap-3 p-2">
        <ItemLink item={item} className="shrink-0">
          {item.image && item.imgHost ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxiedImg(item.image, item.imgHost)}
              alt=""
              loading="lazy"
              className="h-10 w-12 rounded-none border border-white/5 object-cover"
            />
          ) : (
            <span className="flex h-10 w-12 items-center justify-center rounded-none border border-white/5 bg-ink-700 text-mist-500">
              <ImageOff size={13} aria-hidden="true" />
            </span>
          )}
        </ItemLink>
        <p className="line-clamp-1 min-w-0 flex-1 text-xs font-medium" title={item.title}>
          <ItemLink item={item} className="text-mist-100 transition-colors hover:text-neon-300 hover:underline">
            {item.title}
          </ItemLink>
        </p>
        {/* Size cluster: manual size wins as the "ordering" chip; the AI badge
            shows when there's no manual override. Always a toggle for the panel. */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide size options" : "Set size / show details"}
          className="flex items-center gap-1 transition-opacity hover:opacity-80"
        >
          {item.manualSize ? (
            <ManualSizeBadge size={item.manualSize} />
          ) : item.advice ? (
            <AdviceBadge advice={item.advice} />
          ) : (
            <span className="rounded-none border border-dashed border-ink-500 px-1.5 py-0.5 text-[10px] font-medium text-mist-500">
              + size
            </span>
          )}
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={`text-mist-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {item.qty > 1 && (
          <span className="rounded-none bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">
            ×{item.qty}
          </span>
        )}
        <span className="text-[11px] tabular-nums text-mist-500">
          {item.priceCny !== null ? formatMoney(item.priceCny * item.qty, "CNY") : "—"}
        </span>
        <button
          onClick={() => removeFromHaul(haulId, item.id)}
          aria-label="Remove from haul"
          className="rounded px-1.5 py-1 text-mist-500 hover:text-danger"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-white/5 p-3">
          <ManualSizeEditor item={item} />
          {item.advice && (
            <div className="border-t border-white/5 pt-3">
              {item.manualSize && item.manualSize !== item.advice.size && (
                <p className="mb-2 text-[11px] text-mist-500">AI Advisor&apos;s call, for reference:</p>
              )}
              <AdviceDetail advice={item.advice} measurements={measurements} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HaulCard({ haul, focused }: { haul: Haul; focused: boolean }) {
  const {
    prefs, setPrefs, renameHaul, deleteHaul, setHaulBudget, removeFromHaul,
    fmtConverted, toast, applyRef, shareHaul, unshareHaul, setHaulPublic, user, cloudEnabled,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(haul.name);

  const agent = getAgent(prefs.agentId) ?? getAgent(DEFAULT_AGENT_ID)!;
  const items = haul.items;
  const { unitCount, totalCny } = haulStats(items);
  const unpricedCount = items.filter((i) => i.priceCny === null).length;
  // Album-backed items are the ones the AI Advisor can size (they carry a chart source).
  const sizable = items.some((i) => i.id.startsWith("album:"));
  const totalWeight = unitCount * HAUL_UNIT_WEIGHT_G;
  const active = prefs.activeHaulId === haul.id;
  const overBudget = haul.budgetCny !== null && totalCny > haul.budgetCny;
  const budgetPct = haul.budgetCny ? Math.min((totalCny / haul.budgetCny) * 100, 100) : 0;

  const signedIn = cloudEnabled && !!user;
  const shareUrl =
    haul.shareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/haul/${haul.shareSlug}`
      : null;
  const isPublic = haul.sharePublic ?? true;

  const exportText = items
    .map((i) => {
      const parsed = i.url ? parseLink(i.url) : null;
      const link = parsed ? (applyRef(toAgentUrl(parsed, agent), agent.id) ?? i.url) : i.url;
      // Prefer the manually chosen size; fall back to the AI size call if present.
      const size = i.manualSize ?? i.advice?.size;
      return `${i.title}${i.qty > 1 ? ` ×${i.qty}` : ""}${size ? ` — size ${size}` : ""}${link ? `\n${link}` : ""}`;
    })
    .join("\n\n");

  function saveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== haul.name) renameHaul(haul.id, trimmed);
    setEditing(false);
  }

  const shareBtn = "flex items-center gap-1.5 rounded-none border border-ink-500 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      id={`haul-${haul.id}`}
      className={`card-pop fade-up overflow-hidden rounded-none border bg-ink-800/80 scroll-mt-20 ${
        active ? "border-neon-500/50" : "border-white/5"
      } ${focused ? "ring-2 ring-neon-400/60" : ""}`}
    >
      {active && <div className="flow-bg h-0.5" />}
      <div className="p-5">
        <div className="flex gap-4">
          <HaulPreview
            items={items}
            className="h-20 w-20 shrink-0 rounded-none border border-white/5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  className="rounded-none border border-neon-500 bg-ink-900 px-2 py-1 text-sm font-semibold text-mist-100 outline-none"
                />
              ) : (
                <h2 className="text-base font-bold text-mist-100">{haul.name}</h2>
              )}
              <button onClick={() => setEditing(true)} aria-label="Rename haul" className="p-0.5 text-mist-500 hover:text-neon-300">
                <Pencil size={13} aria-hidden="true" />
              </button>
              {active ? (
                <span className="rounded-none border border-neon-400/30 bg-neon-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon-300">
                  Active
                </span>
              ) : (
                <button
                  onClick={() => { setPrefs({ activeHaulId: haul.id }); toast(`${haul.name} is now the active haul`); }}
                  className="rounded-none border border-ink-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mist-500 hover:text-neon-300"
                >
                  Set active
                </button>
              )}
              <button
                onClick={() => { deleteHaul(haul.id); toast(`${haul.name} deleted`, "info"); }}
                className="ml-auto text-xs text-mist-500 transition-colors hover:text-danger"
              >
                Delete
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
              <span>
                {unitCount} item{unitCount === 1 ? "" : "s"} ·{" "}
                <span className="font-semibold text-mist-100">{formatMoney(totalCny, "CNY")}</span>{" "}
                <span className="flow-text font-bold">≈ {fmtConverted(totalCny)}</span>
                {unpricedCount > 0 && <span className="text-mist-500"> +{unpricedCount} unpriced</span>}
              </span>
              {unitCount > 0 && <span>~{(totalWeight / 1000).toFixed(1)} kg est.</span>}
              <label className="ml-auto flex items-center gap-1.5">
                Budget ¥
                <input
                  type="number"
                  min={0}
                  value={haul.budgetCny ?? ""}
                  placeholder="—"
                  onChange={(e) => setHaulBudget(haul.id, e.target.value === "" ? null : Number(e.target.value))}
                  className="w-20 rounded-none border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-mist-100 outline-none focus:border-neon-500"
                />
              </label>
            </div>
          </div>
        </div>

        {haul.budgetCny !== null && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-none bg-ink-600">
              <div
                className={overBudget ? "h-full bg-danger" : "flow-bg h-full"}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className={`mt-1 text-[11px] ${overBudget ? "text-danger" : "text-mist-500"}`}>
              {overBudget
                ? `Over budget by ${formatMoney(totalCny - haul.budgetCny, "CNY")}`
                : `${formatMoney(haul.budgetCny - totalCny, "CNY")} left of ${formatMoney(haul.budgetCny, "CNY")}`}
            </p>
          </div>
        )}

        {/* Share bar */}
        <div className="mt-4 border-t border-white/5 pt-3">
          {!signedIn ? (
            <SignInButton mode="modal">
              <button className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-xs font-semibold text-white">
                <Share2 size={13} aria-hidden="true" /> Sign in to share
              </button>
            </SignInButton>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-mist-500">Add items to share this haul.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <SharePicker
                stores={shareableStores(items)}
                publish={(storeIds) => shareHaul(haul.id, { storeIds })}
                triggerLabel="Share haul"
              />
              {shareUrl && (
                <>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={shareBtn}>
                    <ExternalLink size={13} aria-hidden="true" /> Open
                  </a>
                  <button
                    onClick={() => setHaulPublic(haul.id, !isPublic)}
                    className={shareBtn}
                    title={isPublic ? "Anyone with the link can view" : "Only you can view"}
                  >
                    {isPublic ? <Globe size={13} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}
                    {isPublic ? "Public" : "Private"}
                  </button>
                  <button
                    onClick={() => unshareHaul(haul.id)}
                    className="ml-auto text-xs text-mist-500 transition-colors hover:text-danger"
                  >
                    Unshare
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {sizable && (
          <Link
            href={`/advisor?haul=${haul.id}`}
            className="mt-4 flex items-center justify-center gap-1.5 rounded-none border border-ink-500 px-4 py-2 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
          >
            <Ruler size={13} aria-hidden="true" /> Size this haul with the advisor
          </Link>
        )}

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <HaulItem key={item.id} item={item} haulId={haul.id} />
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
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Your <span className="flow-text">hauls</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Group finds, set budgets, and share a haul as a link or an image. Cart items land in the
          active haul.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New haul name — e.g. Summer fits"
          className="flex-1 rounded-none border border-ink-500 bg-ink-800/80 px-4 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500 sm:max-w-sm"
        />
        <button onClick={add} className="btn-glow flex items-center gap-1.5 rounded-none px-5 py-2.5 text-sm font-semibold text-white">
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

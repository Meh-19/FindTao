"use client";

import { useMemo, useState } from "react";
import { getItem, CATEGORY_WEIGHT_G } from "@/data/catalog";
import { formatMoney } from "@/lib/currency";
import { useStore } from "@/lib/store";

/** Placeholder rate card — real quotes come from the agent at checkout. */
const LINES = [
  { name: "China Post Registered Air", baseCny: 24, perKgCny: 80, days: "15–35" },
  { name: "YunExpress (tax-friendly)", baseCny: 40, perKgCny: 110, days: "10–18" },
  { name: "EU/US Special Line", baseCny: 55, perKgCny: 100, days: "9–16" },
  { name: "SF Express Economy", baseCny: 70, perKgCny: 95, days: "8–14" },
  { name: "EMS", baseCny: 90, perKgCny: 70, days: "7–15" },
];

const REGIONS = [
  { id: "us", label: "United States", mult: 1 },
  { id: "eu", label: "European Union", mult: 1.05 },
  { id: "uk", label: "United Kingdom", mult: 1.0 },
  { id: "ca", label: "Canada", mult: 1.15 },
  { id: "au", label: "Australia", mult: 1.1 },
];

export default function ShippingPage() {
  const { hauls, fmtConverted, hydrated } = useStore();
  const [grams, setGrams] = useState(1500);
  const [region, setRegion] = useState("us");
  const [haulId, setHaulId] = useState("");

  const mult = REGIONS.find((r) => r.id === region)?.mult ?? 1;
  const kg = Math.max(grams, 100) / 1000;

  const quotes = useMemo(
    () =>
      LINES.map((l) => ({ ...l, costCny: Math.round((l.baseCny + l.perKgCny * kg) * mult) })).sort(
        (a, b) => a.costCny - b.costCny,
      ),
    [kg, mult],
  );

  function loadHaul(id: string) {
    setHaulId(id);
    if (!id) return;
    const haul = hauls.find((h) => h.id === id);
    if (!haul) return;
    const weight = haul.items
      .map(getItem)
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .reduce((sum, i) => sum + CATEGORY_WEIGHT_G[i.category], 0);
    if (weight > 0) setGrams(weight);
  }

  if (!hydrated) return null;

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Shipping <span className="flow-text">calculator</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Rough international estimates by weight and destination — your agent quotes the real price
        after weighing the parcel.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-mist-400">
          Weight (g)
          <input
            type="number"
            min={100}
            step={100}
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-ink-500 bg-ink-800/80 px-3 py-2.5 text-sm text-mist-100 outline-none focus:border-neon-500"
          />
        </label>
        <label className="text-xs text-mist-400">
          Destination
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-500 bg-ink-800/80 px-3 py-2.5 text-sm text-mist-100 outline-none focus:border-neon-500"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-mist-400">
          Prefill from haul
          <select
            value={haulId}
            onChange={(e) => loadHaul(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-500 bg-ink-800/80 px-3 py-2.5 text-sm text-mist-100 outline-none focus:border-neon-500"
          >
            <option value="">—</option>
            {hauls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.items.length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-2">
        {quotes.map((q, i) => (
          <div
            key={q.name}
            className={`card-pop fade-up flex items-center gap-3 rounded-xl border px-4 py-3 ${
              i === 0 ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/5 bg-ink-800/80"
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-mist-100">
                {q.name}
                {i === 0 && (
                  <span className="ml-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                    Cheapest
                  </span>
                )}
              </p>
              <p className="text-xs text-mist-500">{q.days} days</p>
            </div>
            <p className="text-right text-sm font-semibold text-mist-100">
              {formatMoney(q.costCny, "CNY")}
              <span className="flow-text block text-xs font-bold">≈ {fmtConverted(q.costCny)}</span>
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist-500">
        Placeholder rate card for planning only — lines, prices, and availability vary by agent,
        weight bracket, and what's in the parcel (batteries, liquids, brands).
      </p>
    </div>
  );
}

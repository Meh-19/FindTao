"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Bot, CheckCircle2, Layers, Loader2, Maximize2, Ruler, SkipForward, Sparkles, X } from "lucide-react";
import { useStore, type SavedItem } from "@/lib/store";
import { proxiedImg } from "@/lib/yupoo";
import {
  EMPTY_MEASUREMENTS,
  FIT_PREFERENCES,
  cmToIn,
  hasMinimumMeasurements,
  inToCm,
  kgToLb,
  lbToKg,
  measurementKey,
  resolveFootLength,
  resolveMeasurements,
  type FitPreference,
  type Measurements,
} from "@/lib/measurements";
import {
  adviceStatus,
  detectReviewBias,
  recommendSize,
  type AdviceStatus,
  type Recommendation,
  type ReviewSignal,
  type SizeAdvice,
  type SizeChart,
} from "@/lib/sizeAdvisor";
import { ChartPicker, type ChartSelection } from "./advisor/ChartPicker";
import { AdvisorResult } from "./advisor/AdvisorResult";
import { Lightbox } from "./Lightbox";

const inputClass =
  "w-full rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";
const labelClass = "block text-xs font-medium text-mist-400";

/** Draft form state is always strings (so a half-typed "9." doesn't get clobbered) in the display unit. */
type Draft = Record<
  | "height" | "weight" | "chest" | "shoulderWidth" | "sleeveLength" | "bodyLength" | "neck"
  | "waist" | "hips" | "inseam" | "thigh" | "rise" | "footLength" | "shoeSizeUs" | "shoeSizeEu" | "shoeSizeUk",
  string
>;

function toDraft(m: Measurements): Draft {
  const len = (cm: number | null) => (cm == null ? "" : (m.unit === "in" ? cmToIn(cm) : cm).toFixed(1));
  const wt = (kg: number | null) => (kg == null ? "" : (m.unit === "in" ? kgToLb(kg) : kg).toFixed(1));
  return {
    height: len(m.heightCm),
    weight: wt(m.weightKg),
    chest: len(m.chestCm),
    shoulderWidth: len(m.shoulderWidthCm),
    sleeveLength: len(m.sleeveLengthCm),
    bodyLength: len(m.bodyLengthCm),
    neck: len(m.neckCm),
    waist: len(m.waistCm),
    hips: len(m.hipsCm),
    inseam: len(m.inseamCm),
    thigh: len(m.thighCm),
    rise: len(m.riseCm),
    footLength: len(m.footLengthCm),
    shoeSizeUs: m.shoeSizeUs?.toString() ?? "",
    shoeSizeEu: m.shoeSizeEu?.toString() ?? "",
    shoeSizeUk: m.shoeSizeUk?.toString() ?? "",
  };
}

function fromDraft(draft: Draft, unit: "in" | "cm"): Partial<Measurements> {
  const len = (s: string): number | null => {
    const n = Number(s);
    if (!s.trim() || !Number.isFinite(n) || n <= 0) return null;
    return unit === "in" ? inToCm(n) : n;
  };
  const wt = (s: string): number | null => {
    const n = Number(s);
    if (!s.trim() || !Number.isFinite(n) || n <= 0) return null;
    return unit === "in" ? lbToKg(n) : n;
  };
  const num = (s: string): number | null => {
    const n = Number(s);
    return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    unit,
    heightCm: len(draft.height),
    weightKg: wt(draft.weight),
    chestCm: len(draft.chest),
    shoulderWidthCm: len(draft.shoulderWidth),
    sleeveLengthCm: len(draft.sleeveLength),
    bodyLengthCm: len(draft.bodyLength),
    neckCm: len(draft.neck),
    waistCm: len(draft.waist),
    hipsCm: len(draft.hips),
    inseamCm: len(draft.inseam),
    thighCm: len(draft.thigh),
    riseCm: len(draft.rise),
    footLengthCm: len(draft.footLength),
    shoeSizeUs: num(draft.shoeSizeUs),
    shoeSizeEu: num(draft.shoeSizeEu),
    shoeSizeUk: num(draft.shoeSizeUk),
  };
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className={`${inputClass} ${suffix ? "pr-9" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function MeasurementForm({ onSaved }: { onSaved: () => void }) {
  const { measurements, setMeasurements, toast } = useStore();
  const [unit, setUnit] = useState<"in" | "cm">(measurements.unit);
  const [draft, setDraft] = useState<Draft>(() => toDraft(measurements));
  const [fitPreference, setFitPreference] = useState<FitPreference>(measurements.fitPreference);

  function set(field: keyof Draft) {
    return (v: string) => setDraft((prev) => ({ ...prev, [field]: v }));
  }

  const lenUnit = unit === "in" ? "in" : "cm";
  const wtUnit = unit === "in" ? "lb" : "kg";

  function save() {
    const patch = fromDraft(draft, unit);
    if (!hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, ...patch })) {
      toast("Height and weight are required — everything else is optional", "error");
      return;
    }
    setMeasurements({ ...patch, fitPreference });
    toast("Measurements saved");
    onSaved();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border border-white/5 bg-ink-800/80 p-4">
        <div>
          <p className="text-sm font-semibold text-mist-100">Units</p>
          <p className="mt-0.5 text-xs text-mist-500">Applies to every field below.</p>
        </div>
        <div className="flex border border-ink-500">
          {(["in", "cm"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                unit === u ? "bg-white text-black" : "text-mist-400 hover:text-mist-100"
              }`}
            >
              {u === "in" ? "Imperial (in/lb)" : "Metric (cm/kg)"}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-white/10 bg-ink-800/80 p-4">
        <p className="text-sm font-semibold text-mist-100">Required — height &amp; weight</p>
        <p className="mt-0.5 text-xs text-mist-500">
          The minimum we need to estimate your BMI and fill in rough body proportions for anything you skip below.
          Measured values you enter always take priority over the estimate.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={`Height (${lenUnit})`} value={draft.height} onChange={set("height")} suffix={lenUnit} />
          <Field label={`Weight (${wtUnit})`} value={draft.weight} onChange={set("weight")} suffix={wtUnit} />
        </div>
      </div>

      <div className="border border-white/5 bg-ink-800/80 p-4">
        <p className="text-sm font-semibold text-mist-100">Measurements <span className="font-normal text-mist-500">(optional, more = more accurate)</span></p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Chest / Bust" value={draft.chest} onChange={set("chest")} suffix={lenUnit} />
          <Field label="Shoulder Width" value={draft.shoulderWidth} onChange={set("shoulderWidth")} suffix={lenUnit} />
          <Field label="Sleeve Length" value={draft.sleeveLength} onChange={set("sleeveLength")} suffix={lenUnit} />
          <Field label="Body Length" value={draft.bodyLength} onChange={set("bodyLength")} suffix={lenUnit} />
          <Field label="Neck" value={draft.neck} onChange={set("neck")} suffix={lenUnit} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Waist" value={draft.waist} onChange={set("waist")} suffix={lenUnit} />
          <Field label="Hips" value={draft.hips} onChange={set("hips")} suffix={lenUnit} />
          <Field label="Inseam" value={draft.inseam} onChange={set("inseam")} suffix={lenUnit} />
          <Field label="Thigh" value={draft.thigh} onChange={set("thigh")} suffix={lenUnit} />
          <Field label="Rise" value={draft.rise} onChange={set("rise")} suffix={lenUnit} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Shoe Size US" value={draft.shoeSizeUs} onChange={set("shoeSizeUs")} />
          <Field label="Shoe Size EU" value={draft.shoeSizeEu} onChange={set("shoeSizeEu")} />
          <Field label="Shoe Size UK" value={draft.shoeSizeUk} onChange={set("shoeSizeUk")} />
          <Field label="Foot Length" value={draft.footLength} onChange={set("footLength")} suffix={lenUnit} />
        </div>
      </div>

      <div className="border border-white/5 bg-ink-800/80 p-4">
        <p className="text-sm font-semibold text-mist-100">Fit preference</p>
        <p className="mt-0.5 text-xs text-mist-500">How much room you want the garment to have over your actual measurements.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FIT_PREFERENCES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFitPreference(f.id)}
              aria-pressed={fitPreference === f.id}
              title={f.blurb}
              className={`border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                fitPreference === f.id
                  ? "border-white bg-white text-black"
                  : "border-ink-500 text-mist-300 hover:border-mist-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} className="btn-glow w-full rounded-none px-4 py-3 text-sm font-semibold text-white">
        Save &amp; continue
      </button>
    </div>
  );
}

type Stage =
  | { kind: "picking" }
  | { kind: "analyzing"; selection: ChartSelection }
  | { kind: "review"; selection: ChartSelection; chart: SizeChart }
  | { kind: "done"; selection: ChartSelection; chart: SizeChart };

const COLUMN_LABEL: Record<string, string> = {
  footLengthCm: "Foot length",
  shoeSizeUs: "US",
  shoeSizeEu: "EU",
  shoeSizeUk: "UK",
};

function columnLabel(key: string): string {
  return COLUMN_LABEL[key] ?? key.replace("Cm", "");
}

function ChartReview({
  chart,
  selection,
  onConfirm,
  onCancel,
}: {
  chart: SizeChart;
  selection: ChartSelection;
  onConfirm: (chart: SizeChart) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(chart.rows);
  const [zoomed, setZoomed] = useState(false);
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) if (k !== "size") keys.add(k);
    return [...keys];
  }, [rows]);

  const imgSrc = proxiedImg(selection.photoUrl, selection.host);

  function setCell(i: number, key: string, value: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const n = Number(value);
        const next = { ...r };
        if (!value.trim()) delete (next as Record<string, unknown>)[key];
        else if (Number.isFinite(n)) (next as unknown as Record<string, number>)[key] = n;
        return next;
      }),
    );
  }

  return (
    <div className="border border-white/10 bg-ink-800/80 p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
        <Sparkles size={14} aria-hidden="true" className="text-neon-300" /> AI read this chart — check it over
      </p>
      <p className="mt-0.5 text-xs text-mist-500">
        Vision models occasionally misread a digit. Compare against the original photo and fix anything that looks
        off before we compare it to your measurements. Detected type: <span className="text-mist-300">{chart.garmentType}</span>.
      </p>

      {/* BUG FIX: this step used to show only the AI's extracted numbers with
          no way to see the actual chart photo, making it impossible to
          actually check the AI's work. Now the source image sits right next
          to the editable table, with a click-to-zoom for a closer look. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <button
          onClick={() => setZoomed(true)}
          aria-label="View size chart photo full size"
          className="group relative block aspect-square w-full max-w-[240px] overflow-hidden border border-white/10 lg:sticky lg:top-4"
        >
          <img src={imgSrc} alt="Size chart source photo" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover:bg-black/40 group-hover:opacity-100">
            <Maximize2 size={20} aria-hidden="true" className="text-white" />
          </span>
        </button>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-mist-500">
                <th className="py-1.5 pr-3 font-medium">Size</th>
                {columns.map((c) => (
                  <th key={c} className="py-1.5 pr-3 font-medium">{columnLabel(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 font-semibold text-mist-100">{row.size}</td>
                  {columns.map((c) => (
                    <td key={c} className="py-1 pr-3">
                      <input
                        type="number"
                        value={(row as unknown as Record<string, number | undefined>)[c] ?? ""}
                        onChange={(e) => setCell(i, c, e.target.value)}
                        className="w-16 rounded-none border border-ink-500 bg-ink-900 px-1.5 py-1 text-xs text-mist-100 outline-none focus:border-neon-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex gap-2">
            <button onClick={() => onConfirm({ ...chart, rows })} className="btn-glow rounded-none px-4 py-2 text-sm font-semibold text-white">
              Looks good — get my size
            </button>
            <button onClick={onCancel} className="border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-danger/40 hover:text-danger">
              Pick a different photo
            </button>
          </div>
        </div>
      </div>

      {zoomed && (
        <Lightbox
          images={[{ src: imgSrc, rawSrc: selection.photoUrl, alt: "Size chart source photo" }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setZoomed(false)}
          title="Size chart"
        />
      )}
    </div>
  );
}

/**
 * Build the persistable size call from a recommendation + the confirmed chart.
 * Stamps the chart and a measurement fingerprint so the size can be shown in
 * detail later and re-scored without another AI read if measurements change.
 */
function adviceFrom(rec: Recommendation, chart: SizeChart, measurements: Measurements): SizeAdvice {
  return {
    size: rec.size,
    confidence: rec.confidence,
    garmentType: chart.garmentType,
    fitPreference: measurements.fitPreference,
    at: Date.now(),
    chart,
    measureKey: measurementKey(measurements),
  };
}

const ALBUM_ID_RE = /^album:([a-z0-9-]+):(\d+)$/i;

/** One item in a batch-sizing run — a haul item that carries a Yupoo host + album id. */
interface BatchItem {
  itemId: string;
  title: string;
  host: string;
  albumId: string;
  storeId: string | null;
  storeName: string;
}

interface BatchState {
  haulName: string;
  items: BatchItem[];
  /** Pointer into items; === items.length once the run is finished. */
  index: number;
  /** itemIds that got a size saved (vs skipped) — for the closing summary. */
  sized: string[];
}

/** Distinct album-backed items from a haul — the only ones the advisor can size (they carry a chart source). */
function albumItemsOf(items: SavedItem[]): BatchItem[] {
  const out: BatchItem[] = [];
  const seen = new Set<string>();
  for (const i of items) {
    const m = i.id.match(ALBUM_ID_RE);
    if (!m || seen.has(i.id)) continue;
    seen.add(i.id);
    out.push({ itemId: i.id, title: i.title, host: m[1], albumId: m[2], storeId: i.storeId || null, storeName: i.storeName });
  }
  return out;
}

/** Entry card on the picker screen: kick off a back-to-back sizing run over a haul. */
function BatchStart({
  hauls,
  onStart,
}: {
  hauls: { id: string; name: string; count: number }[];
  onStart: (haulId: string) => void;
}) {
  return (
    <div className="mb-5 border border-white/10 bg-ink-800/80 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
        <Layers size={14} aria-hidden="true" className="text-neon-300" /> Size a whole haul at once
      </p>
      <p className="mt-0.5 text-xs text-mist-500">
        Walk through every item in a haul back-to-back — each size call saves straight onto the item.
      </p>
      <div className="mt-3 space-y-1.5">
        {hauls.map((h) => (
          <div key={h.id} className="flex items-center gap-3 border border-white/5 bg-ink-900/60 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{h.name}</span>
            <span className="shrink-0 text-xs text-mist-500">
              {h.count} item{h.count === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => onStart(h.id)}
              className="btn-glow shrink-0 rounded-none px-3 py-1.5 text-xs font-semibold text-white"
            >
              Size all
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiAdvisor() {
  const { measurements, hydrated, sb, toast, cart, hauls, setItemAdvice } = useStore();
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "picking" });
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [reviewSignal, setReviewSignal] = useState<ReviewSignal | null>(null);
  // Whether the last confirmed chart's size auto-saved onto an existing cart/haul line.
  const [autoSaved, setAutoSaved] = useState(false);
  // Active back-to-back "size a whole haul" run, or null for the normal one-off flow.
  const [batch, setBatch] = useState<BatchState | null>(null);
  // When the current result reused saved data instead of a fresh AI scan, how it related to the current measurements.
  const [reused, setReused] = useState<AdviceStatus | null>(null);
  // Items the shopper deliberately chose to re-scan with AI despite already having saved data.
  const [forcedItems, setForcedItems] = useState<Set<string>>(() => new Set());
  const haulParam = useSearchParams().get("haul");

  const resolved = useMemo(
    () => ({ ...resolveMeasurements(measurements), footLengthCm: resolveFootLength(measurements) }),
    [measurements],
  );

  /** The saved size call for an item id, wherever it lives (cart or any haul). */
  function findAdvice(itemId: string): SizeAdvice | undefined {
    for (const l of cart) if (l.id === itemId && l.advice) return l.advice;
    for (const h of hauls) for (const i of h.items) if (i.id === itemId && i.advice) return i.advice;
    return undefined;
  }

  // Album-backed items already in the cart or a haul — targets for attaching a size call.
  const attachable = useMemo(() => {
    const byId = new Map<string, string>();
    for (const i of [...cart, ...hauls.flatMap((h) => h.items)]) {
      if (i.id.startsWith("album:")) byId.set(i.id, i.title);
    }
    return [...byId].map(([id, title]) => ({ id, title }));
  }, [cart, hauls]);

  // Hauls that hold at least one sizable (album-backed) item — the batch menu.
  const haulsWithAlbums = useMemo(
    () => hauls.map((h) => ({ id: h.id, name: h.name, count: albumItemsOf(h.items).length })).filter((h) => h.count > 0),
    [hauls],
  );

  const curBatchItem = batch && batch.index < batch.items.length ? batch.items[batch.index] : null;
  const batchComplete = batch !== null && batch.index >= batch.items.length;

  function startBatch(haulId: string) {
    const haul = hauls.find((h) => h.id === haulId);
    const items = haul ? albumItemsOf(haul.items) : [];
    if (!haul || items.length === 0) {
      toast("That haul has no album-based items to size", "error");
      return;
    }
    setBatch({ haulName: haul.name, items, index: 0, sized: [] });
    setForcedItems(new Set());
    setStage({ kind: "picking" });
    setAnalyzeError(null);
    setReviewSignal(null);
    setAutoSaved(false);
    setReused(null);
  }

  /** Move to the next item (optionally recording the current one as sized), or finish the run. */
  function advanceBatch(sizedItemId?: string) {
    setBatch((b) =>
      b ? { ...b, index: b.index + 1, sized: sizedItemId ? [...b.sized, sizedItemId] : b.sized } : b,
    );
    setStage({ kind: "picking" });
    setReviewSignal(null);
    setAutoSaved(false);
    setAnalyzeError(null);
    setReused(null);
  }

  function exitBatch() {
    setBatch(null);
    setForcedItems(new Set());
    setStage({ kind: "picking" });
    setReviewSignal(null);
    setAutoSaved(false);
    setAnalyzeError(null);
    setReused(null);
  }

  // Deep link: /advisor?haul=<id> starts a batch run for that haul once hydrated.
  useEffect(() => {
    if (!hydrated || !haulParam || batch) return;
    startBatch(haulParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, haulParam]);

  // Batch: if the current item already has chart data for these measurements,
  // skip the photo grid and the paid AI read entirely — reuse (or re-score) the
  // saved chart. Only a deliberate "Re-scan with AI" (forcedItems) overrides this.
  useEffect(() => {
    if (!batch || !curBatchItem || stage.kind !== "picking") return;
    if (forcedItems.has(curBatchItem.itemId)) return;
    const existing = findAdvice(curBatchItem.itemId);
    const status = existing?.chart ? adviceStatus(existing, measurements) : "missing";
    if (existing?.chart && status !== "missing") {
      setReused(status);
      handleConfirmChart(existing.chart, {
        host: curBatchItem.host,
        albumId: curBatchItem.albumId,
        storeId: curBatchItem.storeId,
        storeName: curBatchItem.storeName,
        photoUrl: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.index, stage.kind]);

  async function handlePick(selection: ChartSelection, force = false) {
    setAnalyzeError(null);
    const itemId = `album:${selection.host}:${selection.albumId}`;
    // Reuse saved chart data instead of paying for another AI read, unless this
    // item was explicitly flagged for a re-scan.
    const skipReuse = force || forcedItems.has(itemId);
    const existing = skipReuse ? undefined : findAdvice(itemId);
    const status = existing?.chart ? adviceStatus(existing, measurements) : "missing";
    if (existing?.chart && status !== "missing") {
      setReused(status);
      handleConfirmChart(existing.chart, selection);
      return;
    }
    setReused(null);
    setStage({ kind: "analyzing", selection });
    try {
      const res = await fetch("/api/advisor/analyze-chart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host: selection.host, imageUrl: selection.photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.message ?? "Couldn't read that chart");
        setStage({ kind: "picking" });
        return;
      }
      setStage({ kind: "review", selection, chart: data as SizeChart });
    } catch {
      setAnalyzeError("Network error reading the chart — try again");
      setStage({ kind: "picking" });
    }
  }

  async function handleConfirmChart(chart: SizeChart, selection: ChartSelection) {
    let signal: ReviewSignal | null = null;
    if (sb && selection.storeId) {
      const { data } = await sb.from("store_reviews").select("content").eq("store_id", selection.storeId);
      const texts = (data as { content: string }[] | null)?.map((r) => r.content) ?? [];
      signal = detectReviewBias(texts);
    }
    setReviewSignal(signal);

    // Auto-save the size onto the matching cart/haul line if this chart came
    // from an item the shopper already has. Otherwise the result screen offers
    // an attach picker.
    const rec = recommendSize(chart, resolved, measurements.fitPreference, signal ?? undefined);
    const itemId = `album:${selection.host}:${selection.albumId}`;
    const exists = cart.some((l) => l.id === itemId) || hauls.some((h) => h.items.some((i) => i.id === itemId));
    if (rec && exists) {
      setItemAdvice(itemId, adviceFrom(rec, chart, measurements));
      setAutoSaved(true);
      toast(`Saved size ${rec.size} to your haul item`);
    } else {
      setAutoSaved(false);
    }
    setStage({ kind: "done", selection, chart });
  }

  /** Force a paid AI re-read of the current item's chart, overriding the reuse of saved data. */
  function rescan(selection: ChartSelection) {
    setReused(null);
    if (batch && curBatchItem) {
      setForcedItems((s) => new Set(s).add(curBatchItem.itemId));
      setStage({ kind: "picking" });
    } else {
      handlePick(selection, true);
    }
  }

  if (!hydrated) return null;

  if (editing || !hasMinimumMeasurements(measurements)) {
    return (
      <div className="fade-up">
        <Header />
        <MeasurementForm onSaved={() => setEditing(false)} />
      </div>
    );
  }

  const recommendation =
    stage.kind === "done" ? recommendSize(stage.chart, resolved, measurements.fitPreference, reviewSignal ?? undefined) : null;

  return (
    <div className="fade-up">
      <Header />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border border-white/5 bg-ink-800/60 px-4 py-3">
        <p className="text-xs text-mist-400">
          Fit preference: <span className="font-semibold text-mist-100">{measurements.fitPreference}</span>
          {" · "}
          {hasMinimumMeasurements(measurements) ? "Height & weight on file" : "Missing height/weight"}
        </p>
        <div className="flex items-center gap-3">
          <Link href="/fit" className="flex items-center gap-1 text-xs text-neon-300 hover:text-neon-400">
            <Bot size={12} aria-hidden="true" /> Export for AI
          </Link>
          <button onClick={() => setEditing(true)} className="text-xs text-neon-300 hover:text-neon-400">
            Edit measurements
          </button>
        </div>
      </div>

      {analyzeError && (
        <p className="mb-4 flex items-center gap-1.5 border border-danger/30 bg-danger/5 px-4 py-2.5 text-xs text-danger">
          <AlertTriangle size={13} aria-hidden="true" /> {analyzeError}
        </p>
      )}

      {batch && !batchComplete && curBatchItem && (
        <div className="mb-4 border border-neon-500/30 bg-neon-600/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-100">
              <Layers size={13} aria-hidden="true" className="text-neon-300" />
              Sizing “{batch.haulName}” — item {batch.index + 1} of {batch.items.length}
            </p>
            <div className="flex items-center gap-3">
              {stage.kind !== "done" && (
                <button
                  onClick={() => advanceBatch()}
                  className="flex items-center gap-1 text-xs text-mist-400 transition-colors hover:text-mist-100"
                >
                  <SkipForward size={12} aria-hidden="true" /> Skip
                </button>
              )}
              <button
                onClick={exitBatch}
                className="flex items-center gap-1 text-xs text-mist-500 transition-colors hover:text-danger"
              >
                <X size={12} aria-hidden="true" /> Exit
              </button>
            </div>
          </div>
          <p className="mt-1 truncate text-xs text-mist-400" title={curBatchItem.title}>
            {curBatchItem.title}
          </p>
          <div className="mt-2 h-1 overflow-hidden bg-ink-600">
            <div className="flow-bg h-full transition-all" style={{ width: `${(batch.index / batch.items.length) * 100}%` }} />
          </div>
        </div>
      )}

      {batchComplete && batch && (
        <div className="border border-white/10 bg-ink-800/80 p-6 text-center">
          <CheckCircle2 size={26} aria-hidden="true" className="mx-auto text-success" />
          <p className="mt-2 text-lg font-bold text-mist-100">Done sizing “{batch.haulName}”</p>
          <p className="mt-1 text-sm text-mist-400">
            Saved a size on {batch.sized.length} of {batch.items.length} item{batch.items.length === 1 ? "" : "s"}
            {batch.sized.length < batch.items.length ? " — the rest were skipped." : "."} Each one shows on its cart &amp; haul line.
          </p>
          <button onClick={exitBatch} className="btn-glow mt-4 rounded-none px-4 py-2 text-sm font-semibold text-white">
            Back to advisor
          </button>
        </div>
      )}

      {stage.kind === "picking" && !batchComplete &&
        (batch && curBatchItem ? (
          <ChartPicker
            key={curBatchItem.itemId}
            onPick={handlePick}
            initialTarget={{
              host: curBatchItem.host,
              albumId: curBatchItem.albumId,
              storeId: curBatchItem.storeId,
              storeName: curBatchItem.storeName,
            }}
            lockTarget
          />
        ) : (
          <>
            {haulsWithAlbums.length > 0 && <BatchStart hauls={haulsWithAlbums} onStart={startBatch} />}
            <ChartPicker onPick={handlePick} />
          </>
        ))}

      {stage.kind === "analyzing" && (
        <div className="flex flex-col items-center gap-3 border border-dashed border-ink-500 py-16 text-sm text-mist-400">
          <Loader2 size={20} aria-hidden="true" className="animate-spin" />
          Reading the size chart…
        </div>
      )}

      {stage.kind === "review" && (
        <ChartReview
          chart={stage.chart}
          selection={stage.selection}
          onConfirm={(chart) => handleConfirmChart(chart, stage.selection)}
          onCancel={() => setStage({ kind: "picking" })}
        />
      )}

      {stage.kind === "done" && reused && (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border border-neon-500/30 bg-neon-600/10 px-4 py-2.5 text-xs text-mist-300">
          <Sparkles size={13} aria-hidden="true" className="shrink-0 text-neon-300" />
          <span className="flex-1">
            {reused === "current"
              ? "You already sized this and your measurements haven’t changed — reused your saved result, no AI scan spent."
              : "Re-scored from your saved chart against your updated measurements — no new AI scan spent."}
          </span>
          <button
            onClick={() => rescan(stage.selection)}
            className="shrink-0 border border-ink-500 px-2.5 py-1 font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
          >
            Re-scan with AI
          </button>
        </div>
      )}

      {stage.kind === "done" &&
        (recommendation ? (
          <AdvisorResult
            recommendation={recommendation}
            chart={stage.chart}
            reviewSignal={reviewSignal}
            autoSaved={autoSaved}
            attachable={attachable}
            onAttach={(itemId) => {
              setItemAdvice(itemId, adviceFrom(recommendation, stage.chart, measurements));
              setAutoSaved(true);
              toast(`Saved size ${recommendation.size} to your haul item`);
            }}
            onReset={() => {
              if (batch && curBatchItem) {
                advanceBatch(curBatchItem.itemId);
              } else {
                setStage({ kind: "picking" });
                setReviewSignal(null);
                setAutoSaved(false);
                setReused(null);
              }
            }}
            resetLabel={
              batch
                ? batch.index + 1 >= batch.items.length
                  ? "Finish — see summary"
                  : "Save & next item →"
                : "Check another item"
            }
          />
        ) : (
          <div className="border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-400">
            None of the chart's columns overlap with measurements you've entered — add more measurements above, or try
            a chart with different columns.
            <button
              onClick={() => (batch && curBatchItem ? advanceBatch() : setStage({ kind: "picking" }))}
              className="mt-3 block w-full border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
            >
              {batch ? "Skip to next item" : "Try another photo"}
            </button>
          </div>
        ))}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
        <Ruler size={26} aria-hidden="true" className="text-neon-300" />
        AI <span className="flow-text">Advisor</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Measure once, get a size call on every item — compared against the seller&apos;s own chart and, when we have
        them, past buyers&apos; fit notes.
      </p>
    </div>
  );
}

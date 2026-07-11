"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Maximize2, Ruler, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { proxiedImg } from "@/lib/yupoo";
import {
  EMPTY_MEASUREMENTS,
  FIT_PREFERENCES,
  cmToIn,
  hasMinimumMeasurements,
  inToCm,
  kgToLb,
  lbToKg,
  resolveFootLength,
  resolveMeasurements,
  type FitPreference,
  type Measurements,
} from "@/lib/measurements";
import {
  detectReviewBias,
  recommendSize,
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
            <button onClick={onCancel} className="border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-red-400/40 hover:text-red-300">
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

/** Build the persistable size call from a recommendation + the confirmed chart. */
function adviceFrom(rec: Recommendation, chart: SizeChart, fitPreference: SizeAdvice["fitPreference"]): SizeAdvice {
  return { size: rec.size, confidence: rec.confidence, garmentType: chart.garmentType, fitPreference, at: Date.now() };
}

export function AiAdvisor() {
  const { measurements, hydrated, sb, toast, cart, hauls, setItemAdvice } = useStore();
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "picking" });
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [reviewSignal, setReviewSignal] = useState<ReviewSignal | null>(null);
  // Whether the last confirmed chart's size auto-saved onto an existing cart/haul line.
  const [autoSaved, setAutoSaved] = useState(false);

  const resolved = useMemo(
    () => ({ ...resolveMeasurements(measurements), footLengthCm: resolveFootLength(measurements) }),
    [measurements],
  );

  // Album-backed items already in the cart or a haul — targets for attaching a size call.
  const attachable = useMemo(() => {
    const byId = new Map<string, string>();
    for (const i of [...cart, ...hauls.flatMap((h) => h.items)]) {
      if (i.id.startsWith("album:")) byId.set(i.id, i.title);
    }
    return [...byId].map(([id, title]) => ({ id, title }));
  }, [cart, hauls]);

  async function handlePick(selection: ChartSelection) {
    setAnalyzeError(null);
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
      setItemAdvice(itemId, adviceFrom(rec, chart, measurements.fitPreference));
      setAutoSaved(true);
      toast(`Saved size ${rec.size} to your haul item`);
    } else {
      setAutoSaved(false);
    }
    setStage({ kind: "done", selection, chart });
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
        <button onClick={() => setEditing(true)} className="text-xs text-neon-300 hover:text-neon-400">
          Edit measurements
        </button>
      </div>

      {analyzeError && (
        <p className="mb-4 flex items-center gap-1.5 border border-red-400/30 bg-red-400/5 px-4 py-2.5 text-xs text-red-300">
          <AlertTriangle size={13} aria-hidden="true" /> {analyzeError}
        </p>
      )}

      {stage.kind === "picking" && <ChartPicker onPick={handlePick} />}

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

      {stage.kind === "done" &&
        (recommendation ? (
          <AdvisorResult
            recommendation={recommendation}
            chart={stage.chart}
            reviewSignal={reviewSignal}
            autoSaved={autoSaved}
            attachable={attachable}
            onAttach={(itemId) => {
              setItemAdvice(itemId, adviceFrom(recommendation, stage.chart, measurements.fitPreference));
              setAutoSaved(true);
              toast(`Saved size ${recommendation.size} to your haul item`);
            }}
            onReset={() => {
              setStage({ kind: "picking" });
              setReviewSignal(null);
              setAutoSaved(false);
            }}
          />
        ) : (
          <div className="border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-400">
            None of the chart's columns overlap with measurements you've entered — add more measurements above, or try
            a chart with different columns.
            <button
              onClick={() => setStage({ kind: "picking" })}
              className="mt-3 block w-full border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
            >
              Try another photo
            </button>
          </div>
        ))}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight">
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

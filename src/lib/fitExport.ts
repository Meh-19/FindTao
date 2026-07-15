/**
 * "Fit profile for AI" export — a self-contained snapshot of a shopper's body
 * measurements, the sizes they've been advised, and the pieces they own that
 * fit well. Encoded into a link (in the URL hash, so it never hits server logs)
 * and rendered as clean text an AI can read to recommend sizes.
 */

import {
  cmToIn,
  kgToLb,
  resolveFootLength,
  resolveMeasurements,
  type EstimatedField,
  type FitPreference,
  type Measurements,
} from "./measurements";
import type { SavedItem } from "./store";
import type { CollectionPiece } from "./profile";

interface FitMeasure {
  label: string;
  /** Value in the canonical unit (cm for lengths, kg for weight). */
  value: number;
  kind: "len" | "wt";
  measured: boolean;
}

interface FitSized {
  title: string;
  store: string;
  garment: string;
  /** AI-recommended size, when the advisor ran. */
  size?: string;
  confidence?: string;
  /** Size the shopper manually set as what they'll order. */
  chosen?: string;
}

interface FitOwned {
  title: string;
  store: string;
  size: string;
  rating: number;
  review: string;
}

export interface FitExport {
  v: 1;
  at: number;
  fit: FitPreference;
  measures: FitMeasure[];
  sized: FitSized[];
  owned: FitOwned[];
}

const DIM_LABEL: Record<EstimatedField, string> = {
  chestCm: "Chest",
  waistCm: "Waist",
  hipsCm: "Hips",
  shoulderWidthCm: "Shoulders",
  neckCm: "Neck",
  sleeveLengthCm: "Sleeve",
  bodyLengthCm: "Body length",
  inseamCm: "Inseam",
  thighCm: "Thigh",
  riseCm: "Rise",
};

const DIM_ORDER: EstimatedField[] = [
  "chestCm", "shoulderWidthCm", "sleeveLengthCm", "bodyLengthCm", "neckCm",
  "waistCm", "hipsCm", "inseamCm", "thighCm", "riseCm",
];

/** Assemble the export from the shopper's current measurements + cart/haul + collection. */
export function buildFitExport(
  m: Measurements,
  cart: SavedItem[],
  hauls: { items: SavedItem[] }[],
  collection: CollectionPiece[],
): FitExport {
  const measures: FitMeasure[] = [];
  if (m.heightCm != null) measures.push({ label: "Height", value: m.heightCm, kind: "len", measured: true });
  if (m.weightKg != null) measures.push({ label: "Weight", value: m.weightKg, kind: "wt", measured: true });

  const resolved = resolveMeasurements(m);
  for (const dim of DIM_ORDER) {
    const r = resolved[dim];
    if (r) measures.push({ label: DIM_LABEL[dim], value: r.value, kind: "len", measured: r.measured });
  }
  const foot = resolveFootLength(m);
  if (foot) measures.push({ label: "Foot length", value: foot.value, kind: "len", measured: foot.measured });

  // Items with a size on file (an advisor call and/or a manually chosen size), deduped by id.
  const sized: FitSized[] = [];
  const seen = new Set<string>();
  for (const i of [...cart, ...hauls.flatMap((h) => h.items)]) {
    if (seen.has(i.id) || (!i.advice && !i.manualSize)) continue;
    seen.add(i.id);
    sized.push({
      title: i.title,
      store: i.storeName,
      garment: i.advice?.garmentType ?? "unknown",
      size: i.advice?.size,
      confidence: i.advice?.confidence,
      chosen: i.manualSize,
    });
  }

  const owned: FitOwned[] = collection.map((p) => ({
    title: p.title,
    store: p.storeName,
    size: p.size,
    rating: p.rating,
    review: p.review,
  }));

  return { v: 1, at: Date.now(), fit: m.fitPreference, measures, sized, owned };
}

/** URL-safe base64 of the export, for the `#d=` link fragment. */
export function encodeFit(data: FitExport): string {
  const json = JSON.stringify(data);
  const b64 =
    typeof window !== "undefined"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeFit(s: string): FitExport | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, "base64").toString("utf-8");
    const d = JSON.parse(json) as FitExport;
    return d && d.v === 1 && Array.isArray(d.measures) ? d : null;
  } catch {
    return null;
  }
}

function measureLine(mm: FitMeasure): string {
  if (mm.kind === "wt") return `${mm.value.toFixed(1)} kg (${kgToLb(mm.value).toFixed(0)} lb)`;
  return `${mm.value.toFixed(1)} cm (${cmToIn(mm.value).toFixed(1)} in)`;
}

/** Render the export as clean Markdown an AI can read directly. */
export function fitToMarkdown(data: FitExport): string {
  const lines: string[] = [];
  lines.push("# My fit profile (for AI sizing help)");
  lines.push("");
  lines.push(
    "I'm sharing my body measurements, the sizes an app recommended for me, and pieces I own that fit well. " +
      "Use this to recommend what size I should get in new items. Values marked (estimated) were inferred from my " +
      "height and weight, not measured directly.",
  );
  lines.push("");
  lines.push(`## Measurements — preferred fit: ${data.fit}`);
  if (data.measures.length === 0) {
    lines.push("_No measurements on file._");
  } else {
    for (const mm of data.measures) {
      lines.push(`- ${mm.label}: ${measureLine(mm)}${mm.measured ? "" : " (estimated)"}`);
    }
  }
  lines.push("");
  lines.push("## Sizes I've been advised / chose");
  if (data.sized.length === 0) {
    lines.push("_None yet._");
  } else {
    for (const s of data.sized) {
      const parts: string[] = [];
      if (s.size) parts.push(`recommended ${s.size}${s.confidence ? ` (${s.confidence} confidence)` : ""}`);
      if (s.chosen) parts.push(`I'll order ${s.chosen}`);
      lines.push(`- ${s.title} — ${s.store} — ${s.garment} — ${parts.join("; ") || "sized"}`);
    }
  }
  lines.push("");
  lines.push("## What I own and how it fits");
  if (data.owned.length === 0) {
    lines.push("_Nothing in my collection yet._");
  } else {
    for (const o of data.owned) {
      const bits: string[] = [];
      if (o.size) bits.push(`size ${o.size}`);
      if (o.rating > 0) bits.push(`${o.rating}/5 stars`);
      const meta = bits.length ? ` — ${bits.join(", ")}` : "";
      const review = o.review ? ` — "${o.review}"` : "";
      lines.push(`- ${o.title} — ${o.store}${meta}${review}`);
    }
  }
  lines.push("");
  lines.push(`_Snapshot from FindTao on ${new Date(data.at).toISOString().slice(0, 10)}._`);
  return lines.join("\n");
}

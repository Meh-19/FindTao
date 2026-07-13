import type { FitPreference, Measurements } from "./measurements";
import { measurementKey, type EstimatedField, type ResolvedField } from "./measurements";

export type GarmentType = "top" | "bottom" | "outerwear" | "footwear" | "unknown";

/** One row of a size chart, normalized to cm by the chart-reading step. */
export interface ChartRow {
  size: string;
  chestCm?: number;
  shoulderWidthCm?: number;
  sleeveLengthCm?: number;
  bodyLengthCm?: number;
  neckCm?: number;
  waistCm?: number;
  hipsCm?: number;
  inseamCm?: number;
  thighCm?: number;
  riseCm?: number;
  footLengthCm?: number;
  /** Not scored directly (ordinal, not linear) — shown for reference/editing only; footLengthCm drives the actual comparison. */
  shoeSizeUs?: number;
  shoeSizeEu?: number;
  shoeSizeUk?: number;
}

export interface SizeChart {
  garmentType: GarmentType;
  rows: ChartRow[];
}

type Dimension = EstimatedField | "footLengthCm";

const DIMENSIONS: Dimension[] = [
  "chestCm", "shoulderWidthCm", "sleeveLengthCm", "bodyLengthCm", "neckCm",
  "waistCm", "hipsCm", "inseamCm", "thighCm", "riseCm", "footLengthCm",
];

const DIMENSION_LABEL: Record<Dimension, string> = {
  chestCm: "Chest",
  shoulderWidthCm: "Shoulders",
  sleeveLengthCm: "Sleeve",
  bodyLengthCm: "Body length",
  neckCm: "Neck",
  waistCm: "Waist",
  hipsCm: "Hips",
  inseamCm: "Inseam",
  thighCm: "Thigh",
  riseCm: "Rise",
  footLengthCm: "Foot length",
};

/**
 * Circumference-style dimensions — the ones vulnerable to the "measured flat"
 * convention many (especially Chinese-market) charts use: the garment is
 * measured laid flat, straight across, which reads as roughly HALF the
 * actual circumference. Length-style dimensions (sleeve, body length,
 * shoulder width, inseam, rise, foot length) don't have this ambiguity.
 */
const CIRCUMFERENCE_DIMENSIONS = new Set<Dimension>(["chestCm", "waistCm", "hipsCm", "neckCm", "thighCm"]);

/** Which chart dimensions matter for which garment type, and how much. */
const WEIGHTS: Record<GarmentType, Partial<Record<Dimension, number>>> = {
  top: { chestCm: 3, shoulderWidthCm: 2, sleeveLengthCm: 1.5, bodyLengthCm: 1, neckCm: 1 },
  outerwear: { chestCm: 3, shoulderWidthCm: 2.5, sleeveLengthCm: 1.5, bodyLengthCm: 1.5, neckCm: 0.5 },
  bottom: { waistCm: 3, hipsCm: 2, inseamCm: 1.5, thighCm: 1.5, riseCm: 1 },
  footwear: { footLengthCm: 3 },
  unknown: {
    chestCm: 2, waistCm: 2, hipsCm: 1.5, shoulderWidthCm: 1, sleeveLengthCm: 1,
    bodyLengthCm: 1, neckCm: 0.5, inseamCm: 1, thighCm: 1, riseCm: 0.5, footLengthCm: 1,
  },
};

/**
 * Target "ease" range in cm (garment/shoe measurement minus body measurement)
 * per dimension per fit preference — e.g. a "regular" fit chest wants the
 * chart to read 6-12cm bigger than the body's actual chest. Footwear ease
 * is a totally different scale (fractions of a cm of toe room, not tens of
 * cm of garment room) but reuses the same fit-preference axis: "slim" reads
 * as a snugger true-to-size fit, "oversized" as extra room. These are
 * approximate streetwear-fit guidelines, not a universal standard; they're
 * here to give the scorer *some* notion of what each fit preference means
 * per dimension.
 */
const EASE_TARGETS_CM: Record<FitPreference, Partial<Record<Dimension, [number, number]>>> = {
  slim: {
    chestCm: [2, 6], waistCm: [2, 6], hipsCm: [2, 6], neckCm: [0.5, 2], thighCm: [1, 4],
    shoulderWidthCm: [-1, 1], sleeveLengthCm: [-1, 1], bodyLengthCm: [0, 4], inseamCm: [-1, 1], riseCm: [-1, 1],
    footLengthCm: [0.3, 0.8],
  },
  regular: {
    chestCm: [6, 12], waistCm: [6, 12], hipsCm: [6, 12], neckCm: [1.5, 3], thighCm: [3, 7],
    shoulderWidthCm: [0, 2], sleeveLengthCm: [0, 2], bodyLengthCm: [3, 8], inseamCm: [0, 2], riseCm: [0, 2],
    footLengthCm: [0.8, 1.3],
  },
  relaxed: {
    chestCm: [12, 20], waistCm: [12, 20], hipsCm: [10, 18], neckCm: [2.5, 4.5], thighCm: [6, 11],
    shoulderWidthCm: [1.5, 4], sleeveLengthCm: [1, 3], bodyLengthCm: [6, 12], inseamCm: [1, 3], riseCm: [1, 3],
    footLengthCm: [1.3, 1.8],
  },
  oversized: {
    chestCm: [20, 32], waistCm: [18, 28], hipsCm: [16, 26], neckCm: [4, 7], thighCm: [9, 16],
    shoulderWidthCm: [3, 7], sleeveLengthCm: [2, 5], bodyLengthCm: [10, 18], inseamCm: [2, 5], riseCm: [2, 5],
    footLengthCm: [1.8, 2.5],
  },
};

export interface DimensionBreakdown {
  dimension: Dimension;
  label: string;
  bodyCm: number;
  bodyMeasured: boolean;
  chartCm: number;
  /** True when chartCm was doubled from what the chart actually said — see correctFlatMeasurement below. */
  flatCorrected: boolean;
  /** The as-read chart value before any flat-measurement correction. */
  rawChartCm: number;
  easeCm: number;
  /** How far outside the ideal ease range this row falls, in cm (0 = right in the target range). */
  distanceCm: number;
}

/**
 * BUG FIX: many size charts (especially from Chinese sellers) measure
 * circumference dimensions — chest, waist, hips, neck, thigh — with the
 * garment laid FLAT, which reads as roughly half the actual circumference.
 * The vision prompt is told to normalize this itself, but it won't always
 * catch it (chart context isn't always explicit), so this is a second,
 * algorithmic pass: if using the raw chart value produces an implausibly
 * negative ease (garment reading dramatically smaller than the body), check
 * whether doubling it lands in a sane range instead — if so, it almost
 * certainly was a flat measurement, so use the doubled value.
 */
function correctFlatMeasurement(
  dim: Dimension,
  chartVal: number,
  bodyVal: number,
): { value: number; corrected: boolean } {
  if (!CIRCUMFERENCE_DIMENSIONS.has(dim)) return { value: chartVal, corrected: false };
  const ease = chartVal - bodyVal;
  if (ease >= -20) return { value: chartVal, corrected: false };
  const doubledEase = chartVal * 2 - bodyVal;
  if (doubledEase >= -12 && doubledEase <= 40) return { value: chartVal * 2, corrected: true };
  return { value: chartVal, corrected: false };
}

export interface SizeScore {
  row: ChartRow;
  /** Lower is better — weighted average distance from the ideal ease range, in cm. 0 = perfect. */
  score: number;
  matchedDimensions: number;
  breakdown: DimensionBreakdown[];
}

/**
 * Score every row of a chart against the shopper's (resolved) measurements
 * for a given fit preference. Only dimensions present in *both* the chart
 * row and the shopper's measurements are compared — a chart with just
 * chest/shoulder still works fine, it's just less confident (see
 * `confidenceFor`).
 */
export function scoreChart(
  chart: SizeChart,
  resolved: Record<Dimension, ResolvedField | null>,
  fitPreference: FitPreference,
): SizeScore[] {
  const weights = WEIGHTS[chart.garmentType] ?? WEIGHTS.unknown;
  const targets = EASE_TARGETS_CM[fitPreference];

  return chart.rows.map((row) => {
    const breakdown: DimensionBreakdown[] = [];
    let weightedDistance = 0;
    let weightSum = 0;

    for (const dim of DIMENSIONS) {
      const rawChartVal = row[dim];
      const body = resolved[dim];
      const weight = weights[dim];
      const target = targets[dim];
      if (rawChartVal == null || body == null || !weight || !target) continue;

      const { value: chartVal, corrected } = correctFlatMeasurement(dim, rawChartVal, body.value);
      const easeCm = chartVal - body.value;
      const [lo, hi] = target;
      const distanceCm = easeCm < lo ? lo - easeCm : easeCm > hi ? easeCm - hi : 0;

      breakdown.push({
        dimension: dim,
        label: DIMENSION_LABEL[dim],
        bodyCm: body.value,
        bodyMeasured: body.measured,
        chartCm: chartVal,
        flatCorrected: corrected,
        rawChartCm: rawChartVal,
        easeCm,
        distanceCm,
      });
      weightedDistance += distanceCm * weight;
      weightSum += weight;
    }

    return {
      row,
      score: weightSum > 0 ? weightedDistance / weightSum : Infinity,
      matchedDimensions: breakdown.length,
      breakdown,
    };
  });
}

export type Confidence = "high" | "medium" | "low";

/**
 * A recommendation saved onto a cart/haul item so the size call survives past
 * the Advisor screen. Lives inside SavedItem (see lib/store) — persisted with
 * the cart/hauls snapshot, no separate DB column.
 */
export interface SizeAdvice {
  size: string;
  confidence: Confidence;
  garmentType: GarmentType;
  fitPreference: FitPreference;
  /** When it was computed (epoch ms) — lets the UI show "based on an older run" later if needed. */
  at: number;
  /**
   * The confirmed chart this size came from. Cached so the size detail can be
   * shown later, and so a measurement change can be re-scored locally without
   * paying for another AI chart read. Absent on advice saved before this existed.
   */
  chart?: SizeChart;
  /** Fingerprint of the measurements + fit that produced `size` (see measurementKey). */
  measureKey?: string;
}

export type AdviceStatus = "current" | "recomputable" | "missing";

/**
 * How a saved size call relates to the shopper's *current* measurements:
 * - `current`      — measurements/fit unchanged since it was computed; nothing to do, and re-reading the chart would waste an AI call.
 * - `recomputable` — measurements changed, but we cached the chart, so a fresh size can be scored locally for free (no AI).
 * - `missing`      — no saved advice, or it predates chart caching, so a real AI read is needed.
 */
export function adviceStatus(advice: SizeAdvice | undefined, m: Measurements): AdviceStatus {
  if (!advice) return "missing";
  if (advice.measureKey != null && advice.measureKey === measurementKey(m)) return "current";
  if (advice.chart) return "recomputable";
  return "missing";
}

export function confidenceFor(score: SizeScore): Confidence {
  if (score.matchedDimensions >= 3 && score.score <= 3) return "high";
  if (score.matchedDimensions >= 2) return "medium";
  return "low";
}

/** Common size-label tokens in smallest → largest order, for review-bias shifting. */
const SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "xxxl", "3xl", "4xl"];

function sizeIndex(label: string): number {
  const norm = label.trim().toLowerCase();
  const i = SIZE_ORDER.indexOf(norm);
  if (i >= 0) return i;
  const n = Number(norm);
  return Number.isFinite(n) ? n : -1;
}

export type ReviewBias = "runs-small" | "runs-large" | "true-to-size";

export interface ReviewSignal {
  bias: ReviewBias | null;
  votes: { small: number; large: number; trueToSize: number };
  sampleCount: number;
}

const SMALL_RE = /\brun(?:s|ning)?\s+small\b|\bsize\s*up\b|\btight\s+fit\b|\bt(?:oo)?\s*tight\b/i;
const LARGE_RE = /\brun(?:s|ning)?\s+(?:big|large)\b|\bsize\s*down\b|\bbaggy\b|\boversized\b(?!\s+fit)|\bt(?:oo)?\s*loose\b/i;
const TTS_RE = /\btrue\s+to\s+size\b|\btts\b/i;

/**
 * Best-effort keyword scan over free-text store reviews (Discord exports,
 * see /dev's review importer) for a sizing bias. Deliberately simple and
 * deterministic — no AI call here, this is just vote-counting on a handful
 * of common phrases. Only reports a bias when one signal has a clear
 * plurality; ties or a single stray mention report `null` so a lone message
 * can't skew someone's recommendation.
 */
export function detectReviewBias(texts: string[]): ReviewSignal {
  let small = 0, large = 0, trueToSize = 0;
  for (const t of texts) {
    if (SMALL_RE.test(t)) small++;
    if (LARGE_RE.test(t)) large++;
    if (TTS_RE.test(t)) trueToSize++;
  }
  const votes = { small, large, trueToSize };
  const max = Math.max(small, large, trueToSize);
  const tiedForMax = [small, large, trueToSize].filter((v) => v === max).length;
  const bias: ReviewBias | null =
    max === 0 || tiedForMax > 1
      ? null
      : max === small ? "runs-small" : max === large ? "runs-large" : "true-to-size";
  return { bias, votes, sampleCount: texts.length };
}

export interface Recommendation {
  size: string;
  confidence: Confidence;
  score: SizeScore;
  /** Set when review sentiment shifted the pick away from the raw measurement-only best match. */
  adjustedFor: ReviewBias | null;
  reasoning: string[];
}

/**
 * Pick the best-matching size, then nudge by one size tier if store reviews
 * have a clear "runs small"/"runs large" consensus (see detectReviewBias).
 * Never adjusts on a "true to size" or ambiguous/no-signal result.
 */
export function recommendSize(
  chart: SizeChart,
  resolved: Record<Dimension, ResolvedField | null>,
  fitPreference: FitPreference,
  reviewSignal?: ReviewSignal,
): Recommendation | null {
  const scores = scoreChart(chart, resolved, fitPreference);
  const usable = scores.filter((s) => s.matchedDimensions > 0);
  if (usable.length === 0) return null;

  usable.sort((a, b) => a.score - b.score);
  let best = usable[0];
  const reasoning: string[] = [
    `Best match on ${best.matchedDimensions} dimension${best.matchedDimensions === 1 ? "" : "s"}: ` +
      best.breakdown.map((b) => `${b.label} ${b.easeCm >= 0 ? "+" : ""}${b.easeCm.toFixed(1)}cm ease`).join(", "),
  ];

  const flatCorrected = best.breakdown.filter((b) => b.flatCorrected);
  if (flatCorrected.length > 0) {
    reasoning.push(
      `${flatCorrected.map((b) => b.label).join(", ")} looked like a flat (laid-flat) garment measurement — ` +
        `doubled to the actual circumference before comparing (chart said ${flatCorrected
          .map((b) => `${b.rawChartCm.toFixed(1)}cm`)
          .join(", ")}).`,
    );
  }

  let adjustedFor: ReviewBias | null = null;
  if (reviewSignal?.bias === "runs-small" || reviewSignal?.bias === "runs-large") {
    const idx = sizeIndex(best.row.size);
    const direction = reviewSignal.bias === "runs-small" ? 1 : -1; // runs small → size up
    if (idx >= 0) {
      const candidates = chart.rows
        .map((row, i) => ({ row, i, si: sizeIndex(row.size) }))
        .filter((c) => c.si === idx + direction);
      if (candidates.length > 0) {
        const shifted = scores.find((s) => s.row === candidates[0].row);
        if (shifted) {
          best = shifted;
          adjustedFor = reviewSignal.bias;
          reasoning.push(
            `Store reviews consistently say this seller ${reviewSignal.bias === "runs-small" ? "runs small" : "runs large"} ` +
              `(${reviewSignal.bias === "runs-small" ? reviewSignal.votes.small : reviewSignal.votes.large} mention${
                (reviewSignal.bias === "runs-small" ? reviewSignal.votes.small : reviewSignal.votes.large) === 1 ? "" : "s"
              }), so we sized ${reviewSignal.bias === "runs-small" ? "up" : "down"} from the raw measurement match.`,
          );
        }
      }
    }
  } else if (reviewSignal?.bias === "true-to-size") {
    reasoning.push("Store reviews say this seller runs true to size — no adjustment needed.");
  }

  return {
    size: best.row.size,
    confidence: confidenceFor(best),
    score: best,
    adjustedFor,
    reasoning,
  };
}

/**
 * Body measurements + fit preference for the AI Advisor's size recommender.
 * Everything is stored in canonical metric units (cm / kg) regardless of
 * what unit the user typed in, so downstream comparisons against an
 * AI-read size chart (always normalized to cm) never have to guess units.
 */

export type FitPreference = "slim" | "regular" | "relaxed" | "oversized";

export const FIT_PREFERENCES: { id: FitPreference; label: string; blurb: string }[] = [
  { id: "slim", label: "Slim", blurb: "Close to the body, minimal room to spare." },
  { id: "regular", label: "Regular", blurb: "Standard, comfortable fit — the default most brands design for." },
  { id: "relaxed", label: "Relaxed", blurb: "Noticeably roomy, still reads as intentional." },
  { id: "oversized", label: "Oversized", blurb: "Deliberately baggy, streetwear drop-shoulder territory." },
];

export interface Measurements {
  /** Input/display unit for the form — stored values below are always cm/kg regardless. */
  unit: "in" | "cm";
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  shoulderWidthCm: number | null;
  sleeveLengthCm: number | null;
  bodyLengthCm: number | null;
  neckCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  inseamCm: number | null;
  thighCm: number | null;
  riseCm: number | null;
  shoeSizeUs: number | null;
  shoeSizeEu: number | null;
  shoeSizeUk: number | null;
  footLengthCm: number | null;
  fitPreference: FitPreference;
}

export const EMPTY_MEASUREMENTS: Measurements = {
  unit: "in",
  heightCm: null,
  weightKg: null,
  chestCm: null,
  shoulderWidthCm: null,
  sleeveLengthCm: null,
  bodyLengthCm: null,
  neckCm: null,
  waistCm: null,
  hipsCm: null,
  inseamCm: null,
  thighCm: null,
  riseCm: null,
  shoeSizeUs: null,
  shoeSizeEu: null,
  shoeSizeUk: null,
  footLengthCm: null,
  fitPreference: "regular",
};

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function cmToIn(cm: number): number {
  return cm / 2.54;
}

export function kgToLb(kg: number): number {
  return kg * 2.2046226;
}

export function lbToKg(lb: number): number {
  return lb / 2.2046226;
}

/** Height + weight are the only hard requirement — everything else is optional detail. */
export function hasMinimumMeasurements(m: Measurements): boolean {
  return m.heightCm != null && m.heightCm > 0 && m.weightKg != null && m.weightKg > 0;
}

/**
 * Stable fingerprint of every field that influences a size recommendation —
 * all canonical measurements plus the fit preference (display `unit` is
 * irrelevant since values are stored in cm/kg). A saved size call stamps this;
 * when it still matches, the recommendation can't have changed, so there's no
 * reason to re-read the chart or recompute. See sizeAdvisor `adviceStatus`.
 */
export function measurementKey(m: Measurements): string {
  return [
    m.heightCm, m.weightKg, m.chestCm, m.shoulderWidthCm, m.sleeveLengthCm,
    m.bodyLengthCm, m.neckCm, m.waistCm, m.hipsCm, m.inseamCm, m.thighCm,
    m.riseCm, m.footLengthCm, m.shoeSizeUs, m.shoeSizeEu, m.shoeSizeUk,
    m.fitPreference,
  ]
    .map((v) => (v == null ? "" : v))
    .join("|");
}

export function bmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type EstimatedField =
  | "chestCm"
  | "waistCm"
  | "hipsCm"
  | "shoulderWidthCm"
  | "neckCm"
  | "sleeveLengthCm"
  | "bodyLengthCm"
  | "inseamCm"
  | "thighCm"
  | "riseCm";

/**
 * Rough anthropometric fallback for any field the user hasn't measured
 * directly, derived from height scaled by how far BMI sits from a 22
 * "reference" midpoint. These ratios are loose averages from published
 * adult sizing data — NOT a substitute for a real tape measurement, and
 * they don't account for build/sex differences. Only used to fill gaps;
 * every field actually typed by the user always wins (see
 * resolveMeasurements below), and the UI must label estimated fields as
 * such rather than presenting them as measured fact.
 */
export function estimateProportions(heightCm: number, weightKg: number): Record<EstimatedField, number> {
  const bmiDelta = (bmi(heightCm, weightKg) - 22) * 1.6;
  return {
    chestCm: heightCm * 0.52 + bmiDelta,
    waistCm: heightCm * 0.44 + bmiDelta * 1.2,
    hipsCm: heightCm * 0.54 + bmiDelta,
    shoulderWidthCm: heightCm * 0.235 + bmiDelta * 0.15,
    neckCm: heightCm * 0.21 + bmiDelta * 0.3,
    sleeveLengthCm: heightCm * 0.33,
    bodyLengthCm: heightCm * 0.4,
    inseamCm: heightCm * 0.45,
    thighCm: heightCm * 0.31 + bmiDelta * 0.5,
    riseCm: heightCm * 0.15 + bmiDelta * 0.2,
  };
}

export interface ResolvedField {
  value: number;
  /** False when this came straight from what the user typed; true when backfilled from height/BMI. */
  measured: boolean;
}

/**
 * Merge the user's actual entries with the height/BMI fallback estimate —
 * measured values always take priority. Returns null for a field only when
 * we have neither a measurement nor enough data (height+weight) to estimate it.
 */
export function resolveMeasurements(m: Measurements): Record<EstimatedField, ResolvedField | null> {
  const estimate = hasMinimumMeasurements(m) ? estimateProportions(m.heightCm!, m.weightKg!) : null;
  const fields: EstimatedField[] = [
    "chestCm", "waistCm", "hipsCm", "shoulderWidthCm", "neckCm",
    "sleeveLengthCm", "bodyLengthCm", "inseamCm", "thighCm", "riseCm",
  ];
  const out = {} as Record<EstimatedField, ResolvedField | null>;
  for (const f of fields) {
    const measured = m[f];
    if (measured != null) out[f] = { value: measured, measured: true };
    else if (estimate) out[f] = { value: estimate[f], measured: false };
    else out[f] = null;
  }
  return out;
}

/**
 * Rough (unisex, ballpark) shoe-size → foot-length conversions in cm. Real
 * lasts vary a lot by brand/region/gender, so these are only used when the
 * shopper hasn't entered a foot length directly — always flagged as
 * estimated, never treated as exact. US/UK are linear fits through common
 * published size charts; EU (Paris point) is ~2/3cm per point by definition.
 */
export function usSizeToFootCm(us: number): number {
  return us * 0.847 + 18.0;
}

export function ukSizeToFootCm(uk: number): number {
  return uk * 0.847 + 18.9;
}

export function euSizeToFootCm(eu: number): number {
  return eu * 0.667;
}

/**
 * Foot length for the footwear scorer — prefers a directly measured length,
 * then falls back to whichever shoe size the shopper entered (US, then EU,
 * then UK), converted via the approximations above. Unlike
 * resolveMeasurements, this has no BMI-based fallback: foot length doesn't
 * correlate with height/weight closely enough to guess responsibly, so it's
 * simply unavailable (null) until the shopper enters *something* footwear-related.
 */
export function resolveFootLength(m: Measurements): ResolvedField | null {
  if (m.footLengthCm != null) return { value: m.footLengthCm, measured: true };
  if (m.shoeSizeUs != null) return { value: usSizeToFootCm(m.shoeSizeUs), measured: false };
  if (m.shoeSizeEu != null) return { value: euSizeToFootCm(m.shoeSizeEu), measured: false };
  if (m.shoeSizeUk != null) return { value: ukSizeToFootCm(m.shoeSizeUk), measured: false };
  return null;
}

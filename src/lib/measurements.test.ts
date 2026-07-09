import { describe, expect, it } from "vitest";
import {
  EMPTY_MEASUREMENTS,
  bmi,
  cmToIn,
  euSizeToFootCm,
  hasMinimumMeasurements,
  inToCm,
  kgToLb,
  lbToKg,
  resolveFootLength,
  resolveMeasurements,
  ukSizeToFootCm,
  usSizeToFootCm,
  type Measurements,
} from "./measurements";

describe("unit conversions", () => {
  it("converts inches/cm both ways and round-trips", () => {
    expect(inToCm(10)).toBeCloseTo(25.4, 5);
    expect(cmToIn(25.4)).toBeCloseTo(10, 5);
    expect(cmToIn(inToCm(70))).toBeCloseTo(70, 5);
  });

  it("converts kg/lb both ways and round-trips", () => {
    expect(kgToLb(1)).toBeCloseTo(2.2046226, 5);
    expect(lbToKg(2.2046226)).toBeCloseTo(1, 5);
    expect(lbToKg(kgToLb(75))).toBeCloseTo(75, 5);
  });
});

describe("hasMinimumMeasurements", () => {
  it("is false with nothing entered", () => {
    expect(hasMinimumMeasurements(EMPTY_MEASUREMENTS)).toBe(false);
  });

  it("is false with only one of height/weight", () => {
    expect(hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, heightCm: 178 })).toBe(false);
    expect(hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, weightKg: 70 })).toBe(false);
  });

  it("is true once both height and weight are present and positive", () => {
    expect(hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, heightCm: 178, weightKg: 70 })).toBe(true);
  });

  it("rejects zero/negative values", () => {
    expect(hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, heightCm: 0, weightKg: 70 })).toBe(false);
    expect(hasMinimumMeasurements({ ...EMPTY_MEASUREMENTS, heightCm: 178, weightKg: -5 })).toBe(false);
  });
});

describe("bmi", () => {
  it("computes standard BMI (kg / m^2)", () => {
    // 70kg at 175cm → 70 / 1.75^2 ≈ 22.86
    expect(bmi(175, 70)).toBeCloseTo(22.857, 2);
  });
});

describe("resolveMeasurements", () => {
  const base: Measurements = { ...EMPTY_MEASUREMENTS, heightCm: 178, weightKg: 75 };

  it("returns null for every field when height/weight are missing", () => {
    const resolved = resolveMeasurements(EMPTY_MEASUREMENTS);
    expect(resolved.chestCm).toBeNull();
    expect(resolved.waistCm).toBeNull();
  });

  it("backfills an unset field from the height/BMI estimate, flagged unmeasured", () => {
    const resolved = resolveMeasurements(base);
    expect(resolved.chestCm).not.toBeNull();
    expect(resolved.chestCm!.measured).toBe(false);
    expect(resolved.chestCm!.value).toBeGreaterThan(0);
  });

  it("prefers a directly measured value over the estimate", () => {
    const withChest: Measurements = { ...base, chestCm: 101.6 };
    const resolved = resolveMeasurements(withChest);
    expect(resolved.chestCm).toEqual({ value: 101.6, measured: true });
  });
});

describe("shoe-size → foot-length conversions", () => {
  it("produce plausible adult foot lengths (roughly 20-32cm)", () => {
    expect(usSizeToFootCm(9)).toBeGreaterThan(20);
    expect(usSizeToFootCm(9)).toBeLessThan(32);
    expect(ukSizeToFootCm(8)).toBeGreaterThan(20);
    expect(euSizeToFootCm(42)).toBeGreaterThan(20);
    expect(euSizeToFootCm(42)).toBeLessThan(32);
  });

  it("increase monotonically with size", () => {
    expect(usSizeToFootCm(10)).toBeGreaterThan(usSizeToFootCm(9));
    expect(euSizeToFootCm(43)).toBeGreaterThan(euSizeToFootCm(42));
  });
});

describe("resolveFootLength", () => {
  it("is null with nothing footwear-related entered", () => {
    expect(resolveFootLength(EMPTY_MEASUREMENTS)).toBeNull();
  });

  it("prefers a direct foot-length measurement over any shoe size", () => {
    const m: Measurements = { ...EMPTY_MEASUREMENTS, footLengthCm: 26.5, shoeSizeUs: 9 };
    expect(resolveFootLength(m)).toEqual({ value: 26.5, measured: true });
  });

  it("falls back to US, then EU, then UK shoe size, flagged unmeasured", () => {
    const usOnly: Measurements = { ...EMPTY_MEASUREMENTS, shoeSizeUs: 9 };
    const usResult = resolveFootLength(usOnly);
    expect(usResult?.measured).toBe(false);
    expect(usResult?.value).toBeCloseTo(usSizeToFootCm(9), 5);

    const euOnly: Measurements = { ...EMPTY_MEASUREMENTS, shoeSizeEu: 42 };
    expect(resolveFootLength(euOnly)?.value).toBeCloseTo(euSizeToFootCm(42), 5);

    const ukOnly: Measurements = { ...EMPTY_MEASUREMENTS, shoeSizeUk: 8 };
    expect(resolveFootLength(ukOnly)?.value).toBeCloseTo(ukSizeToFootCm(8), 5);
  });
});

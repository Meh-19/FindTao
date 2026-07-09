import { describe, expect, it } from "vitest";
import { recommendSize, scoreChart, type SizeChart } from "./sizeAdvisor";
import type { ResolvedField } from "./measurements";

function measured(value: number): ResolvedField {
  return { value, measured: true };
}

describe("scoreChart — flat-measurement correction", () => {
  it("doubles a chest value that was clearly measured flat", () => {
    // A 101.6cm (40in) chest body measurement against a chart that lists
    // "52" for chest — a classic laid-flat garment measurement (half the
    // real 104cm circumference). The raw ease (52-101.6=-49.6) is
    // implausible for any real top, so it should be doubled.
    const chart: SizeChart = { garmentType: "top", rows: [{ size: "M", chestCm: 52 }] };
    const resolved = { chestCm: measured(101.6) } as never;
    const [score] = scoreChart(chart, resolved, "regular");
    expect(score.breakdown[0].flatCorrected).toBe(true);
    expect(score.breakdown[0].chartCm).toBe(104);
    expect(score.breakdown[0].rawChartCm).toBe(52);
    expect(score.breakdown[0].easeCm).toBeCloseTo(2.4, 1);
  });

  it("does not double a plausible chest value", () => {
    const chart: SizeChart = { garmentType: "top", rows: [{ size: "L", chestCm: 110 }] };
    const resolved = { chestCm: measured(101.6) } as never;
    const [score] = scoreChart(chart, resolved, "regular");
    expect(score.breakdown[0].flatCorrected).toBe(false);
    expect(score.breakdown[0].chartCm).toBe(110);
  });

  it("never doubles a length dimension (sleeve), even with a very negative ease", () => {
    const chart: SizeChart = { garmentType: "top", rows: [{ size: "S", sleeveLengthCm: 20 }] };
    const resolved = { sleeveLengthCm: measured(65) } as never;
    const [score] = scoreChart(chart, resolved, "regular");
    expect(score.breakdown[0].flatCorrected).toBe(false);
    expect(score.breakdown[0].chartCm).toBe(20);
  });

  it("leaves a doubled figure alone if doubling would overshoot into an implausible range", () => {
    // chest=10 doubled is 20 — still wildly implausible either way, so this
    // is genuinely bad/illegible data, not a flat measurement, and should
    // not be "corrected" into something equally wrong.
    const chart: SizeChart = { garmentType: "top", rows: [{ size: "M", chestCm: 10 }] };
    const resolved = { chestCm: measured(101.6) } as never;
    const [score] = scoreChart(chart, resolved, "regular");
    expect(score.breakdown[0].flatCorrected).toBe(false);
  });
});

describe("scoreChart — footwear", () => {
  const chart: SizeChart = {
    garmentType: "footwear",
    rows: [
      { size: "9", footLengthCm: 26.5 },
      { size: "10", footLengthCm: 27.5 },
    ],
  };
  const resolved = { footLengthCm: measured(26.2) } as never;

  it("picks the size whose ease lands in the regular-fit toe-room range", () => {
    // Size 9 → 0.3cm ease (tighter than "regular" wants: 0.8-1.3cm).
    // Size 10 → 1.3cm ease (right at the top of the regular range) — a
    // closer match than size 9's undershoot, so 10 should win here.
    const rec = recommendSize(chart, resolved, "regular");
    expect(rec?.size).toBe("10");
  });

  it("picks the snugger size for a slim fit preference", () => {
    // "slim" wants only 0.3-0.8cm of toe room, which is exactly what size
    // 9 gives (0.3cm) — size 10's 1.3cm overshoots the slim range.
    const rec = recommendSize(chart, resolved, "slim");
    expect(rec?.size).toBe("9");
  });
});

describe("recommendSize — reasoning surfaces flat correction", () => {
  it("mentions the flat-measurement correction in the reasoning", () => {
    const chart: SizeChart = { garmentType: "top", rows: [{ size: "M", chestCm: 52, sleeveLengthCm: 63 }] };
    const resolved = { chestCm: measured(101.6), sleeveLengthCm: measured(62) } as never;
    const rec = recommendSize(chart, resolved, "regular");
    expect(rec?.reasoning.some((line) => line.includes("flat"))).toBe(true);
  });
});

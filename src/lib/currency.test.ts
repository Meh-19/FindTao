import { describe, expect, it } from "vitest";
import { convertCny, FALLBACK_RATES, formatCnyWith, formatMoney } from "./currency";

describe("convertCny", () => {
  it("converts using the fallback rate table by default", () => {
    expect(convertCny(100, "USD")).toBeCloseTo(13.9, 5);
  });

  it("converts to CNY as a no-op (rate 1)", () => {
    expect(convertCny(250, "CNY")).toBe(250);
  });

  it("uses a supplied custom rate table over the fallback", () => {
    const customRates = { ...FALLBACK_RATES, USD: 0.2 };
    expect(convertCny(100, "USD", customRates)).toBeCloseTo(20, 5);
  });
});

describe("formatMoney", () => {
  it("formats CNY with the ¥ symbol and 2 decimals", () => {
    expect(formatMoney(199.5, "CNY")).toBe("¥199.50");
  });

  it("formats USD with the $ symbol", () => {
    expect(formatMoney(29.99, "USD")).toBe("$29.99");
  });

  it("formats zero-decimal currencies (JPY/KRW) with no decimal places", () => {
    expect(formatMoney(1500.7, "JPY")).toBe("JP¥1501");
    expect(formatMoney(20000, "KRW")).toBe("₩20000");
  });

  it("rounds to the currency's decimal precision", () => {
    expect(formatMoney(10.999, "EUR")).toBe("€11.00");
  });
});

describe("formatCnyWith", () => {
  it("shows only the CNY figure when the display currency is CNY", () => {
    expect(formatCnyWith(100, "CNY")).toBe("¥100.00");
  });

  it("shows CNY alongside the converted display currency otherwise", () => {
    expect(formatCnyWith(100, "USD")).toBe("¥100.00 ≈ $13.90");
  });

  it("uses a supplied rate table for the conversion", () => {
    const customRates = { ...FALLBACK_RATES, GBP: 0.5 };
    expect(formatCnyWith(100, "GBP", customRates)).toBe("¥100.00 ≈ £50.00");
  });
});

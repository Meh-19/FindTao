import { describe, expect, it } from "vitest";
import { parsePriceCny, parsePriceCnyDetailed, pickBestPrice } from "./price";

describe("parsePriceCnyDetailed — explicit currency markers", () => {
  it.each([
    ["¥168 blank tee", 168],
    ["350gsm tee 128￥", 128],
    ["168元 loose fit", 168],
    ["RMB 238 new arrival", 238],
    ["rmb:238", 238],
    ["Price: 158", 158],
    ["价格:158", 158],
    ["238 rmb shipped", 238],
  ])("reads %s as an explicit (non-estimate) price", (text, expected) => {
    const result = parsePriceCnyDetailed(text);
    expect(result).toEqual({ value: expected, estimate: false });
  });

  it("strips thousands-separator commas before matching", () => {
    expect(parsePriceCnyDetailed("¥1,280 jacket")).toEqual({ value: 1280, estimate: false });
  });

  it("rejects an out-of-range explicit match and falls through", () => {
    // ¥3 is below the sanity floor (5) — should not match as explicit, and
    // there's no bare-number fallback candidate either (only 1 digit).
    expect(parsePriceCnyDetailed("¥3 tag")).toBeNull();
  });
});

describe("parsePriceCnyDetailed — bare-number fallback (estimate)", () => {
  it("reads an unmarked 3-digit price as an estimate", () => {
    expect(parsePriceCnyDetailed("New tee 180")).toEqual({ value: 180, estimate: true });
  });

  it("does not fall back for a 2-digit or 4-digit bare number", () => {
    expect(parsePriceCnyDetailed("size 42 fits true")).toBeNull();
    expect(parsePriceCnyDetailed("est 2026 release")).toBeNull();
  });
});

describe("parsePriceCnyDetailed — false-positive guards (regression: 100% cotton bug)", () => {
  it("does not read '100% cotton' as a ¥100 price", () => {
    expect(parsePriceCnyDetailed("220gsm washed black 100% cotton loose fit blank t-shirt")).toBeNull();
  });

  it("does not read a fabric-weight number ('gsm') as a price", () => {
    expect(parsePriceCnyDetailed("350gsm Union Kingdom Baggy Fit Pleated Pant")).toBeNull();
    expect(parsePriceCnyDetailed("600 gsm heavyweight hoodie")).toBeNull();
  });

  it("does not read a measurement unit (cm/mm/kg/oz) as a price", () => {
    expect(parsePriceCnyDetailed("chest 104cm regular fit")).toBeNull();
    expect(parsePriceCnyDetailed("weighs 450 kg")).toBeNull();
  });

  it("does not read a material-percentage number as a price", () => {
    expect(parsePriceCnyDetailed("100% polyester lining")).toBeNull();
    expect(parsePriceCnyDetailed("80% cotton 100% nylon blend")).toBeNull();
  });

  it("still finds a real bare price sitting next to excluded terms elsewhere in the string", () => {
    expect(parsePriceCnyDetailed("220gsm 100% cotton tee, 180 shipped")).toEqual({ value: 180, estimate: true });
  });
});

describe("pickBestPrice — across description + title", () => {
  it("falls back to the title when the description has no price", () => {
    // The real bug: description present but priceless meant the title price was ignored.
    expect(pickBestPrice("13oz canvas work pants, model wears M", "Fyredwrld jeans ¥268")).toEqual({
      value: 268,
      estimate: false,
    });
  });

  it("prefers the description price when it has one", () => {
    expect(pickBestPrice("￥270 heavyweight tee", "cool tee ¥999")).toEqual({ value: 270, estimate: false });
  });

  it("prefers a marked title price over a bare-number estimate in the description", () => {
    // "model is 180 tall" would parse as an estimate; a marked title price should win.
    expect(pickBestPrice("model is 180 tall", "denim jacket ¥320")).toEqual({ value: 320, estimate: false });
  });

  it("uses an estimate only when no source has a marked price", () => {
    expect(pickBestPrice("loose fit 180", "washed tee")).toEqual({ value: 180, estimate: true });
  });

  it("skips empty/null sources and returns null when nothing parses", () => {
    expect(pickBestPrice(null, "", "just a plain name")).toBeNull();
  });
});

describe("parsePriceCny (back-compat helper)", () => {
  it("returns just the numeric value", () => {
    expect(parsePriceCny("¥238 new arrival")).toBe(238);
  });

  it("returns null when nothing parses", () => {
    expect(parsePriceCny("100% cotton, no price listed")).toBeNull();
  });
});

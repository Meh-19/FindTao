import { describe, it, expect, beforeEach } from "vitest";
import { getHistory, latestPrice, lastPriceChange, priceChangeSince, priceChangesSince, recordPrice, scaleChange } from "./priceHistory";

// These run in node, where localStorage doesn't exist — stand up the bits the module uses.
function stubStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    },
  });
}

const ID = "album:firerep:12345";

describe("recordPrice", () => {
  beforeEach(stubStorage);

  it("records the first observation", () => {
    recordPrice(ID, 300);
    expect(latestPrice(ID)).toMatchObject({ cny: 300 });
  });

  it("ignores a repeat of the current price, so the series is only real changes", () => {
    recordPrice(ID, 300);
    recordPrice(ID, 300);
    recordPrice(ID, 300);
    expect(getHistory(ID)).toHaveLength(1);
  });

  it("appends a change and can return to a prior price", () => {
    recordPrice(ID, 300);
    recordPrice(ID, 255);
    recordPrice(ID, 300);
    expect(getHistory(ID).map((p) => p.cny)).toEqual([300, 255, 300]);
  });

  it("rejects nonsense values", () => {
    recordPrice(ID, 0);
    recordPrice(ID, -5);
    recordPrice(ID, Number.NaN);
    expect(getHistory(ID)).toHaveLength(0);
  });

  it("caps the series length", () => {
    for (let i = 1; i <= 20; i++) recordPrice(ID, 100 + i);
    expect(getHistory(ID).length).toBeLessThanOrEqual(8);
    expect(latestPrice(ID)!.cny).toBe(120);
  });
});

describe("priceChangeSince", () => {
  beforeEach(stubStorage);

  it("reports a drop against the price the shopper saved at", () => {
    recordPrice(ID, 255);
    const change = priceChangeSince(ID, 300);
    expect(change).toMatchObject({ from: 300, to: 255, deltaCny: -45, deltaPct: -15 });
  });

  it("reports a rise as a positive delta", () => {
    recordPrice(ID, 330);
    expect(priceChangeSince(ID, 300)!.deltaPct).toBe(10);
  });

  it("returns null when the price is unchanged, unknown, or never seen", () => {
    recordPrice(ID, 300);
    expect(priceChangeSince(ID, 300)).toBeNull();
    expect(priceChangeSince(ID, null)).toBeNull();
    expect(priceChangeSince("album:other:1", 300)).toBeNull();
  });

  it("ignores sub-1% wobble", () => {
    recordPrice(ID, 1001);
    expect(priceChangeSince(ID, 1000)).toBeNull();
  });
});

describe("lastPriceChange", () => {
  beforeEach(stubStorage);

  it("compares the two most recent observations", () => {
    recordPrice(ID, 400);
    recordPrice(ID, 300);
    expect(lastPriceChange(ID)).toMatchObject({ from: 400, to: 300, deltaPct: -25 });
  });

  it("needs two points to have moved", () => {
    recordPrice(ID, 400);
    expect(lastPriceChange(ID)).toBeNull();
  });
});

describe("scaleChange", () => {
  const change = { from: 200, to: 230, deltaCny: 30, deltaPct: 15, at: 0 };

  it("scales the money to the line quantity but leaves the percentage alone", () => {
    expect(scaleChange(change, 2)).toMatchObject({ from: 400, to: 460, deltaCny: 60, deltaPct: 15 });
  });

  it("passes a single unit (or nothing) straight through", () => {
    expect(scaleChange(change, 1)).toBe(change);
    expect(scaleChange(null, 3)).toBeNull();
  });
});

describe("priceChangesSince", () => {
  beforeEach(stubStorage);

  it("resolves a batch in one pass, keying by item id", () => {
    recordPrice("album:a:1", 255);
    recordPrice("album:b:2", 100);
    const out = priceChangesSince([
      { id: "album:a:1", priceCny: 300 },
      { id: "album:b:2", priceCny: 100 },
      { id: "album:c:3", priceCny: 50 },
    ]);
    expect(out["album:a:1"]).toMatchObject({ deltaCny: -45 });
    expect(out["album:b:2"]).toBeNull(); // unchanged
    expect(out["album:c:3"]).toBeNull(); // never observed
  });
});

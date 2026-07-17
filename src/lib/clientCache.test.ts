import { describe, it, expect, beforeEach } from "vitest";
import { cacheGet, cacheSet, CACHE_TTL } from "./clientCache";

function stubStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    },
  });
  return map;
}

function countEntries(map: Map<string, string>): number {
  return [...map.keys()].filter((k) => k.startsWith("findtao:cache:")).length;
}

/** One Yupoo store page writes a price per album on its first page, plus the listing. */
const ENTRIES_PER_STORE = 121;

describe("cacheGet / cacheSet", () => {
  beforeEach(stubStorage);

  it("round-trips a value", () => {
    cacheSet("price", "firerep:1", { p: { value: 300, estimate: false } }, CACHE_TTL.price);
    expect(cacheGet("price", "firerep:1")).toEqual({ p: { value: 300, estimate: false } });
  });

  it("misses on an unknown key", () => {
    expect(cacheGet("price", "nope")).toBeNull();
  });

  it("expires an entry past its TTL", () => {
    cacheSet("price", "old", { p: null }, -1);
    expect(cacheGet("price", "old")).toBeNull();
  });

  it("keeps namespaces apart", () => {
    cacheSet("price", "x", "a", CACHE_TTL.price);
    cacheSet("product", "x", "b", CACHE_TTL.product);
    expect(cacheGet("price", "x")).toBe("a");
    expect(cacheGet("product", "x")).toBe("b");
  });
});

describe("eviction", () => {
  beforeEach(stubStorage);

  /**
   * REGRESSION: the cap used to be 220 — below two stores' worth — so opening a
   * second store evicted the first one's prices and every revisit re-scraped
   * 120 descriptions with blank prices until they landed.
   */
  it("keeps several stores' worth of prices without evicting", () => {
    const map = stubStorage();
    for (let store = 0; store < 5; store++) {
      for (let i = 0; i < ENTRIES_PER_STORE; i++) {
        cacheSet("price", `store${store}:${i}`, { p: { value: 300, estimate: false } }, CACHE_TTL.price);
      }
    }
    expect(countEntries(map)).toBe(5 * ENTRIES_PER_STORE);
    // The first store browsed is the one the old cap dropped first.
    expect(cacheGet("price", "store0:0")).not.toBeNull();
    expect(cacheGet("price", "store4:120")).not.toBeNull();
  });

  it("still bounds the store once it genuinely runs away", () => {
    const map = stubStorage();
    for (let i = 0; i < 2400; i++) cacheSet("price", `k:${i}`, i, CACHE_TTL.price);
    // Sweeps run periodically rather than on every write, so allow a little slack.
    expect(countEntries(map)).toBeLessThanOrEqual(2100);
  });

  it("drops the oldest entries first when it does evict", () => {
    for (let i = 0; i < 2400; i++) cacheSet("price", `k:${i}`, i, CACHE_TTL.price);
    // The most recent writes must survive; the earliest are the ones to go.
    expect(cacheGet("price", "k:2399")).toBe(2399);
    expect(cacheGet("price", "k:0")).toBeNull();
  });
});

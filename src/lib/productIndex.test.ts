import { describe, it, expect, beforeEach } from "vitest";
import { getSightings, otherSellers, recordSightings, sightingCounts, type ProductSighting } from "./productIndex";

// Runs in node, where localStorage doesn't exist — stand up what the module uses.
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

const KEY = "taobao:1041917371194";

function sighting(over: Partial<ProductSighting> = {}): ProductSighting {
  return {
    storeId: "firerep",
    storeName: "FireRep",
    host: "firerep",
    yupooId: "1",
    title: "Bootcut jeans",
    priceCny: 300,
    at: 1000,
    ...over,
  };
}

describe("recordSightings", () => {
  beforeEach(stubStorage);

  it("records a listing under its product", () => {
    recordSightings([{ key: KEY, sighting: sighting() }]);
    expect(getSightings(KEY)).toHaveLength(1);
  });

  it("updates a re-seen album in place rather than duplicating it", () => {
    recordSightings([{ key: KEY, sighting: sighting({ priceCny: 300 }) }]);
    recordSightings([{ key: KEY, sighting: sighting({ priceCny: 255, at: 2000 }) }]);
    const all = getSightings(KEY);
    expect(all).toHaveLength(1);
    expect(all[0].priceCny).toBe(255);
  });

  it("keeps distinct albums apart", () => {
    recordSightings([
      { key: KEY, sighting: sighting({ yupooId: "1" }) },
      { key: KEY, sighting: sighting({ yupooId: "2", storeId: "b", storeName: "StoreB", host: "b" }) },
    ]);
    expect(getSightings(KEY)).toHaveLength(2);
  });

  it("caps sightings per product", () => {
    for (let i = 0; i < 20; i++) {
      recordSightings([
        { key: KEY, sighting: sighting({ yupooId: String(i), storeId: `s${i}`, host: `h${i}`, at: 1000 + i }) },
      ]);
    }
    expect(getSightings(KEY).length).toBeLessThanOrEqual(8);
  });
});

describe("otherSellers", () => {
  beforeEach(stubStorage);

  it("excludes the current store and sorts cheapest first", () => {
    recordSightings([
      { key: KEY, sighting: sighting({ yupooId: "1", priceCny: 300 }) },
      { key: KEY, sighting: sighting({ host: "b", yupooId: "9", storeId: "b", storeName: "StoreB", priceCny: 255 }) },
      { key: KEY, sighting: sighting({ host: "c", yupooId: "7", storeId: "c", storeName: "StoreC", priceCny: 400 }) },
    ]);
    expect(otherSellers(KEY, { storeId: "firerep" }).map((s) => s.storeName)).toEqual(["StoreB", "StoreC"]);
  });

  it("never offers a store its own other colourway as a rival seller", () => {
    // One Taobao id, two albums, same store — real FireRep data looks exactly
    // like this ("Tracksuit red" / "Tracksuit navy").
    recordSightings([
      { key: KEY, sighting: sighting({ yupooId: "244412048", title: "Tracksuit red" }) },
      { key: KEY, sighting: sighting({ yupooId: "244411887", title: "Tracksuit navy" }) },
    ]);
    expect(otherSellers(KEY, { storeId: "firerep" })).toEqual([]);
  });

  it("sinks unpriced listings below priced ones", () => {
    recordSightings([
      { key: KEY, sighting: sighting({ host: "b", yupooId: "9", storeId: "b", storeName: "StoreB", priceCny: null }) },
      { key: KEY, sighting: sighting({ host: "c", yupooId: "7", storeId: "c", storeName: "StoreC", priceCny: 400 }) },
    ]);
    expect(otherSellers(KEY, { storeId: "firerep" }).map((s) => s.storeName)).toEqual(["StoreC", "StoreB"]);
  });

  it("shows one entry per rival store when that seller lists the item twice", () => {
    recordSightings([
      { key: KEY, sighting: sighting({ host: "b", yupooId: "9", storeId: "b", storeName: "StoreB", at: 2000 }) },
      { key: KEY, sighting: sighting({ host: "b", yupooId: "10", storeId: "b", storeName: "StoreB", at: 3000 }) },
    ]);
    expect(otherSellers(KEY, { storeId: "firerep" })).toHaveLength(1);
  });

  it("is empty for an unknown product", () => {
    expect(otherSellers("taobao:doesnotexist", { storeId: "x" })).toEqual([]);
  });
});

describe("sightingCounts", () => {
  beforeEach(stubStorage);

  it("counts distinct stores, not listings", () => {
    recordSightings([
      { key: KEY, sighting: sighting({ host: "b", yupooId: "9", storeId: "b", storeName: "StoreB" }) },
      { key: KEY, sighting: sighting({ host: "b", yupooId: "10", storeId: "b", storeName: "StoreB" }) },
      { key: KEY, sighting: sighting({ host: "c", yupooId: "7", storeId: "c", storeName: "StoreC" }) },
    ]);
    expect(sightingCounts([KEY])[KEY]).toBe(2);
    expect(sightingCounts(["taobao:nope"])["taobao:nope"]).toBe(0);
  });
});

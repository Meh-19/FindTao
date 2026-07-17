import { describe, it, expect } from "vitest";
import {
  formatVolume,
  hasWeight,
  sanitizeProductDetails,
  supportsProductDetails,
  upstreamMarketplace,
  type ProductDetails,
} from "./productDetails";

/** Shaped like the upstream Item Details response documented in its OpenAPI spec. */
const payload = {
  item: {
    id: "1041917371194",
    title: "示例商品标题",
    price: 198,
    thumbnailUrl: "https://img.example/thumb.jpg",
    imgUrls: ["https://img.example/1.jpg", "https://img.example/2.jpg"],
    shipping: { weight: 860, volume: { length: 38, width: 33, height: 8 }, domesticFreight: 18 },
    sales: 1240,
  },
};

describe("sanitizeProductDetails", () => {
  it("maps a full payload", () => {
    const d = sanitizeProductDetails(payload, "weidian", "1041917371194")!;
    expect(d).toMatchObject({
      id: "1041917371194",
      marketplace: "weidian",
      title: "示例商品标题",
      priceCny: 198,
      sales: 1240,
    });
    expect(d.shipping).toMatchObject({ weight: 860, domesticFreight: 18 });
    expect(d.shipping.volume).toEqual({ length: 38, width: 33, height: 8 });
    expect(d.imgUrls).toHaveLength(2);
  });

  it("treats an unmeasured item's zeroes as unknown, not as facts", () => {
    // Agents report never-shipped items as 0g / 0*0*0 — "0 g" on screen is a lie.
    const d = sanitizeProductDetails(
      { item: { ...payload.item, shipping: { weight: 0, volume: { length: 0, width: 0, height: 0 }, domesticFreight: 0 } } },
      "weidian",
      "1",
    )!;
    expect(d.shipping).toEqual({ weight: null, volume: null, domesticFreight: null });
    expect(hasWeight(d)).toBe(false);
  });

  it("drops a partial volume rather than reporting half a box", () => {
    const d = sanitizeProductDetails(
      { item: { ...payload.item, shipping: { weight: 200, volume: { length: 10, width: 5 } } } },
      "taobao",
      "1",
    )!;
    expect(d.shipping.volume).toBeNull();
    expect(d.shipping.weight).toBe(200);
  });

  it("survives missing and junk fields", () => {
    const d = sanitizeProductDetails({ item: { title: "  ", price: "nope", imgUrls: [1, "https://ok"], sales: -5 } }, "taobao", "9")!;
    expect(d.title).toBeNull();
    expect(d.priceCny).toBeNull();
    expect(d.imgUrls).toEqual(["https://ok"]);
    expect(d.sales).toBeNull();
    expect(d.shipping).toEqual({ weight: null, volume: null, domesticFreight: null });
  });

  it("rejects a response with no item", () => {
    expect(sanitizeProductDetails({}, "taobao", "1")).toBeNull();
    expect(sanitizeProductDetails(null, "taobao", "1")).toBeNull();
    expect(sanitizeProductDetails({ item: "nope" }, "taobao", "1")).toBeNull();
  });

  it("caps runaway image lists", () => {
    const many = Array.from({ length: 40 }, (_, i) => `https://img/${i}.jpg`);
    expect(sanitizeProductDetails({ item: { imgUrls: many } }, "taobao", "1")!.imgUrls).toHaveLength(12);
  });
});

describe("marketplace support", () => {
  it("maps the marketplaces the upstream resolves", () => {
    expect(upstreamMarketplace("taobao")).toBe("taobao");
    expect(upstreamMarketplace("weidian")).toBe("weidian");
    expect(upstreamMarketplace("1688")).toBe("1688");
  });

  it("knows xianyu is not resolvable", () => {
    expect(upstreamMarketplace("xianyu")).toBeNull();
    expect(supportsProductDetails("xianyu")).toBe(false);
    expect(supportsProductDetails("weidian")).toBe(true);
  });
});

describe("presentation helpers", () => {
  it("formats a volume", () => {
    expect(formatVolume({ length: 38, width: 33, height: 8 })).toBe("38 × 33 × 8 cm");
  });

  it("hasWeight is false for nothing at all", () => {
    expect(hasWeight(null)).toBe(false);
    expect(hasWeight({ shipping: { weight: 860 } } as ProductDetails)).toBe(true);
  });
});

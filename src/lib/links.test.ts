import { describe, expect, it } from "vitest";
import { canonicalUrl, isShortLink, parseLink, toAgentUrl } from "./links";
import { AGENTS, getAgent } from "./agents";

describe("parseLink — marketplaces", () => {
  it("parses a standard taobao item link", () => {
    expect(parseLink("https://item.taobao.com/item.htm?id=675330292891")).toEqual({
      marketplace: "taobao",
      itemId: "675330292891",
      rawUrl: "https://item.taobao.com/item.htm?id=675330292891",
    });
  });

  it("parses mobile and world taobao variants", () => {
    expect(parseLink("https://m.intl.taobao.com/detail/detail.html?id=123456")?.itemId).toBe("123456");
    expect(parseLink("https://world.taobao.com/item/987654.htm?spm=abc")?.itemId).toBe("987654");
  });

  it("parses tmall as taobao", () => {
    const parsed = parseLink("https://detail.tmall.com/item.htm?id=555666777");
    expect(parsed?.marketplace).toBe("taobao");
    expect(parsed?.itemId).toBe("555666777");
  });

  it("parses weidian links with varying param casing", () => {
    expect(parseLink("https://weidian.com/item.html?itemID=7234567890")?.marketplace).toBe("weidian");
    expect(parseLink("https://weidian.com/item.html?itemId=7234567890")?.itemId).toBe("7234567890");
    expect(parseLink("https://shop123.v.weidian.com/item.html?itemID=42")?.itemId).toBe("42");
  });

  it("parses 1688 offer links", () => {
    expect(parseLink("https://detail.1688.com/offer/678901234567.html")).toMatchObject({
      marketplace: "1688",
      itemId: "678901234567",
    });
    expect(parseLink("https://m.1688.com/offer/678901234567.html")?.marketplace).toBe("1688");
  });

  it("accepts links without a protocol", () => {
    expect(parseLink("item.taobao.com/item.htm?id=42")?.itemId).toBe("42");
  });

  it("ignores tracking params", () => {
    const parsed = parseLink("https://item.taobao.com/item.htm?spm=a21n57.1.0.0&id=99&utm_source=x");
    expect(parsed?.itemId).toBe("99");
  });

  it("rejects garbage and non-product links", () => {
    expect(parseLink("")).toBeNull();
    expect(parseLink("hello world")).toBeNull();
    expect(parseLink("https://www.google.com/search?q=taobao")).toBeNull();
    expect(parseLink("https://weidian.com/?userid=123")).toBeNull();
  });
});

describe("parseLink — agent link unwrapping", () => {
  const raw = "https://weidian.com/item.html?itemID=7234567890";

  it("unwraps url-param agents (superbuy family)", () => {
    const link = `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(raw)}`;
    expect(parseLink(link)).toMatchObject({ marketplace: "weidian", itemId: "7234567890" });
  });

  it("unwraps hash-fragment agents (sugargoo family)", () => {
    const link = `https://www.sugargoo.com/#/home/productDetail?productLink=${encodeURIComponent(raw)}`;
    expect(parseLink(link)).toMatchObject({ marketplace: "weidian", itemId: "7234567890" });
  });

  it("unwraps shop_type/id agents (cnfans family)", () => {
    expect(parseLink("https://cnfans.com/product/?shop_type=weidian&id=7234567890")).toMatchObject({
      marketplace: "weidian",
      itemId: "7234567890",
    });
    expect(parseLink("https://cnfans.com/product/?shop_type=ali_1688&id=555")).toMatchObject({
      marketplace: "1688",
      itemId: "555",
    });
  });

  it("survives double-encoded wrapped urls", () => {
    const link = `https://www.kakobuy.com/item/details?url=${encodeURIComponent(encodeURIComponent(raw))}`;
    expect(parseLink(link)).toMatchObject({ marketplace: "weidian", itemId: "7234567890" });
  });
});

describe("toAgentUrl", () => {
  const link = parseLink("https://item.taobao.com/item.htm?id=675330292891")!;

  it("fills url-wrapping templates", () => {
    const out = toAgentUrl(link, getAgent("superbuy")!);
    expect(out).toBe(
      `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(link.rawUrl)}`,
    );
  });

  it("fills id-based templates per marketplace", () => {
    expect(toAgentUrl(link, getAgent("cnfans")!)).toBe(
      "https://cnfans.com/product/?shop_type=taobao&id=675330292891",
    );
    const weidian = parseLink("https://weidian.com/item.html?itemID=42")!;
    expect(toAgentUrl(weidian, getAgent("cnfans")!)).toBe(
      "https://cnfans.com/product/?shop_type=weidian&id=42",
    );
  });

  it("appends ref fragments with the right separator", () => {
    const agent = { ...getAgent("cnfans")!, ref: "ref=findtao" };
    expect(toAgentUrl(link, agent)).toContain("&ref=findtao");
    const bare = {
      ...agent,
      templates: { all: "https://example.com/buy/{itemId}" },
    };
    expect(toAgentUrl(link, bare)).toBe("https://example.com/buy/675330292891?ref=findtao");
  });

  it("round-trips: converted agent links parse back to the same item", () => {
    for (const agent of AGENTS) {
      const out = toAgentUrl(link, agent);
      expect(out, agent.id).toBeTruthy();
      expect(parseLink(out!), agent.id).toMatchObject({
        marketplace: link.marketplace,
        itemId: link.itemId,
      });
    }
  });
});

describe("helpers", () => {
  it("canonicalUrl builds each marketplace", () => {
    expect(canonicalUrl("taobao", "1")).toContain("item.taobao.com");
    expect(canonicalUrl("weidian", "1")).toContain("weidian.com");
    expect(canonicalUrl("1688", "1")).toContain("detail.1688.com/offer/1.html");
  });

  it("flags short links that need resolving first", () => {
    expect(isShortLink("https://m.tb.cn/h.abc123")).toBe(true);
    expect(isShortLink("https://k.youshop10.com/xyz")).toBe(true);
    expect(isShortLink("https://item.taobao.com/item.htm?id=1")).toBe(false);
  });
});

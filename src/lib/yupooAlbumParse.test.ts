import { describe, expect, it } from "vitest";
import {
  extractDescription,
  extractItemLinks,
  extractPhotos,
  extractTitle,
} from "./yupooAlbumParse";

const P = (hash: string, variant: string) => `https://photo.yupoo.com/pengreps/${hash}/${variant}.jpg`;

describe("extractPhotos — one entry per photo, highest quality", () => {
  it("collapses the big + square + medium variants of a photo to a single big url", () => {
    // The bug: each photo ships several sizes in data-src, and deduping by exact
    // URL showed every photo twice (sharp + thumbnail).
    const html = `
      <img data-src="${P("aaa", "big")}">
      <img data-src="${P("aaa", "square")}">
      <img data-src="${P("aaa", "medium")}">
      <img data-src="${P("bbb", "square")}">
      <img data-src="${P("bbb", "big")}">
    `;
    expect(extractPhotos(html)).toEqual([P("aaa", "big"), P("bbb", "big")]);
  });

  it("keeps the best available variant when big is absent", () => {
    const html = `<img data-src="${P("ccc", "square")}"><img data-src="${P("ccc", "medium")}">`;
    expect(extractPhotos(html)).toEqual([P("ccc", "medium")]);
  });

  it("preserves first-seen order and normalises protocol-relative urls", () => {
    const html = `<img data-src="//photo.yupoo.com/x/zzz/big.jpg"><img data-src="${P("yyy", "big")}">`;
    expect(extractPhotos(html)).toEqual(["https://photo.yupoo.com/x/zzz/big.jpg", P("yyy", "big")]);
  });

  it("returns nothing when there are no photo urls", () => {
    expect(extractPhotos("<div>no photos here</div>")).toEqual([]);
  });
});

const ldJson = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe("extractTitle — album name for deep-links", () => {
  it("reads the ImageGallery JSON-LD name (where a title-only price lives)", () => {
    const html = ldJson({ "@type": "Organization" }) + ldJson({ "@type": "ImageGallery", name: "¥369" });
    expect(extractTitle(html)).toBe("¥369");
  });

  it("falls back to og:title's first segment when there's no JSON-LD name", () => {
    const html = `<meta property="og:title" content="¥200 | 相册 | tigerrep | Catalog">`;
    expect(extractTitle(html)).toBe("¥200");
  });

  it("returns null when neither source is present", () => {
    expect(extractTitle("<html></html>")).toBeNull();
  });
});

describe("extractDescription — the price/link block", () => {
  it("reads the ImageGallery description over the meta fallback", () => {
    const html = ldJson({ "@type": "ImageGallery", description: "￥270\nhttps://weidian.com/item.html?itemID=1" });
    expect(extractDescription(html)).toContain("￥270");
  });

  it("falls back to the itemprop meta description", () => {
    const html = `<meta name="description" itemprop="description" content="￥88 tee">`;
    expect(extractDescription(html)).toBe("￥88 tee");
  });
});

describe("extractItemLinks — distinct marketplace urls", () => {
  it("pulls taobao/weidian links and dedupes, ignoring agent-wrapped copies", () => {
    const src =
      "https://item.taobao.com/item.htm?id=123 https://weidian.com/item.html?itemID=9 " +
      "https://item.taobao.com/item.htm?id=123 https://kakobuy.com/?url=item.taobao.com";
    expect(extractItemLinks(src)).toEqual([
      "https://item.taobao.com/item.htm?id=123",
      "https://weidian.com/item.html?itemID=9",
    ]);
  });
});

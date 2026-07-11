import { describe, expect, it } from "vitest";
import { decodeEntities, extractPreview } from "./marketplacePreview";

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Tee &amp; Shorts &#39;24&#39; &quot;fit&quot;")).toBe(`Tee & Shorts '24' "fit"`);
  });
});

describe("extractPreview — og/meta scraping", () => {
  it("reads title, image, and explicit price regardless of attribute order", () => {
    const html = `
      <meta property="og:title" content="Heavyweight Hoodie &amp; Tee">
      <meta content="//img.example.com/x.jpg" property="og:image">
      <meta itemprop="price" content="199">
    `;
    const p = extractPreview(html, "taobao");
    expect(p.title).toBe("Heavyweight Hoodie & Tee");
    expect(p.image).toBe("https://img.example.com/x.jpg");
    expect(p.priceCny).toBe(199);
    expect(p.priceEstimate).toBe(false);
  });

  it("falls back to the CNY text heuristic when no explicit price field exists", () => {
    const html = `<meta property="og:title" content="New drop ¥288"><meta property="og:description" content="ships fast">`;
    const p = extractPreview(html, "1688");
    expect(p.priceCny).toBe(288);
  });

  it("resolves a Weidian seller id into a shop URL", () => {
    const html = `<title>Cool Shop</title><script>{"userid":"1234567","x":1}</script>`;
    const p = extractPreview(html, "weidian");
    expect(p.sellerUserId).toBe("1234567");
    expect(p.sellerShopUrl).toBe("https://weidian.com/?userid=1234567");
  });

  it("degrades to nulls on a login-walled page with no useful tags", () => {
    const p = extractPreview("<html><body>login required</body></html>", "taobao");
    expect(p.title).toBeNull();
    expect(p.image).toBeNull();
    expect(p.priceCny).toBeNull();
    expect(p.sellerUserId).toBeNull();
  });
});

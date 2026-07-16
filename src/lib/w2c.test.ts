import { describe, it, expect } from "vitest";
import { imageHash, scoreTitle, searchTerms, type W2CIdentity } from "./w2c";

const identity: W2CIdentity = {
  category: "varsity jacket",
  garmentType: "outerwear",
  brand: "Syna World",
  colors: ["black", "cream"],
  keywords: ["varsity jacket", "leather sleeve"],
  keywordsZh: ["棒球服"],
  notes: "Cream leather sleeves.",
};

describe("scoreTitle", () => {
  it("ranks a brand match above a keyword match", () => {
    const brand = scoreTitle("Syna World tee", identity);
    const keyword = scoreTitle("varsity jacket restock", identity);
    expect(brand!.score).toBeGreaterThan(keyword!.score);
  });

  it("ignores a title that only shares a colour", () => {
    expect(scoreTitle("black cargo pants", identity)).toBeNull();
  });

  it("matches Chinese seller terms", () => {
    const match = scoreTitle("新款 棒球服 男", identity);
    expect(match).not.toBeNull();
    expect(match!.hits).toContain("棒球服");
  });

  it("scores a full brand + keyword + colour title highest and reports every hit", () => {
    const match = scoreTitle("Syna World varsity jacket black leather sleeve", identity);
    expect(match!.score).toBeGreaterThan(scoreTitle("Syna World tee", identity)!.score);
    expect(match!.hits).toEqual(expect.arrayContaining(["syna world", "varsity jacket", "leather sleeve", "black"]));
  });

  it("is case-insensitive", () => {
    expect(scoreTitle("SYNA WORLD JACKET", identity)).not.toBeNull();
  });

  it("does not double-count a term repeated in the title", () => {
    const once = scoreTitle("Syna World tee", identity)!.score;
    const twice = scoreTitle("Syna World tee", identity)!.score;
    expect(twice).toBe(once);
  });

  it("returns null when nothing matches", () => {
    expect(scoreTitle("plain white socks", identity)).toBeNull();
  });
});

describe("searchTerms", () => {
  it("leads with the brand and dedupes", () => {
    const terms = searchTerms({ ...identity, keywords: ["Syna World", "varsity jacket"] });
    expect(terms[0]).toBe("syna world");
    expect(terms.filter((t) => t === "syna world")).toHaveLength(1);
  });

  it("drops stopwords and one-character noise", () => {
    const terms = searchTerms({ ...identity, brand: null, keywords: ["the", "a", "tee"] });
    expect(terms).not.toContain("the");
    expect(terms).toContain("tee");
  });
});

describe("imageHash", () => {
  it("is stable for the same input and differs for another", () => {
    expect(imageHash("abc")).toBe(imageHash("abc"));
    expect(imageHash("abc")).not.toBe(imageHash("abd"));
  });
});

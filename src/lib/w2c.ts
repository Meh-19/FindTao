/**
 * "W2C" (where to cop) — identify a garment from a photo, then hunt for it in
 * the catalog and the shopper's followed stores.
 *
 * The AI's only job is turning a picture into *search terms*; the matching
 * itself is plain local text scoring against album titles we already have. That
 * keeps it to one cheap vision call per distinct image, and the result is
 * cached by image hash so re-running the same photo costs nothing.
 */

import type { GarmentType } from "./sizeAdvisor";

export interface W2CIdentity {
  /** Plain-language garment name, e.g. "boxy varsity jacket". */
  category: string;
  garmentType: GarmentType;
  /** Brand or collab if legible on the piece, else null — never a guess. */
  brand: string | null;
  colors: string[];
  /** English search terms, most distinctive first. */
  keywords: string[];
  /** Terms a Chinese seller would title the album with. */
  keywordsZh: string[];
  /** One line on the details that distinguish it from lookalikes. */
  notes: string;
}

export interface W2CMatch {
  title: string;
  score: number;
  /** Which of the identity's terms actually hit. */
  hits: string[];
}

const STOPWORDS = new Set(["the", "a", "an", "and", "with", "for", "of", "in", "on"]);

/** Terms worth searching on, deduped and lowercased. Brand first — it's the strongest signal. */
export function searchTerms(identity: W2CIdentity): string[] {
  const raw = [
    ...(identity.brand ? [identity.brand] : []),
    ...identity.keywords,
    ...identity.keywordsZh,
    ...identity.colors,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of raw) {
    const t = term.trim().toLowerCase();
    if (!t || t.length < 2 || STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Score a listing title against the identity. Weighted so a brand hit counts
 * for far more than a colour hit — every third album is "black", but only the
 * right one says "syna world".
 */
export function scoreTitle(title: string, identity: W2CIdentity): W2CMatch | null {
  const haystack = title.toLowerCase();
  const hits: string[] = [];
  let score = 0;

  const weigh = (terms: string[], weight: number) => {
    for (const term of terms) {
      const t = term.trim().toLowerCase();
      if (t.length < 2 || STOPWORDS.has(t) || !haystack.includes(t)) continue;
      hits.push(t);
      score += weight;
    }
  };

  if (identity.brand) weigh([identity.brand], 10);
  weigh(identity.keywords, 3);
  weigh(identity.keywordsZh, 3);
  weigh([identity.category], 2);
  weigh(identity.colors, 1);

  // A lone colour match is noise, not a find.
  return score >= 2 ? { title, score, hits: [...new Set(hits)] } : null;
}

/** Stable 32-bit hash of a data URL, for caching an identification per image. */
export function imageHash(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface ParsedPrice {
  value: number;
  /** True when no explicit currency marker was found — a bare 3-digit
   *  number fallback was used, so the UI should caveat it as an estimate. */
  estimate: boolean;
}

/**
 * Detect a CNY price in seller-written text. Yupoo album titles carry prices
 * in wildly inconsistent formats: "238 RMB", "¥168", "168元", "rmb299",
 * "Price:158", "350gsm tee 128￥" — this walks the common patterns and
 * returns the first plausible match. Falls back to a bare 3-digit number
 * (e.g. "180", "220") when no currency-marked price is present, since
 * sellers often drop the symbol entirely — that match is flagged as an
 * estimate so callers can label it accordingly.
 */
export function parsePriceCnyDetailed(text: string): ParsedPrice | null {
  const t = text.replace(/[，,]/g, "");

  const markedPatterns = [
    /(?:¥|￥)\s*(\d{1,6}(?:\.\d{1,2})?)/, // ¥168
    /(\d{1,6}(?:\.\d{1,2})?)\s*(?:¥|￥|元)/, // 168¥ / 168元
    /(?:rmb|cny)[\s:：]*(\d{1,6}(?:\.\d{1,2})?)/i, // RMB 238 / rmb:238
    /(\d{1,6}(?:\.\d{1,2})?)\s*(?:rmb|cny)\b/i, // 238 RMB
    /(?:price|价格)[\s:：]*(\d{1,6}(?:\.\d{1,2})?)/i, // Price: 158
  ];

  for (const re of markedPatterns) {
    const m = t.match(re);
    if (m) {
      const value = Number(m[1]);
      // Sanity window — rules out sizes (46), years (2026), phone numbers.
      if (value >= 5 && value <= 100000) return { value, estimate: false };
    }
  }

  // Last resort: a bare 3-digit number not glued to a size/measurement/
  // fabric unit — common seller shorthand like "New tee 180". Excludes "%"
  // on both sides (BUG FIX: "100% cotton" was being read as ¥100 on nearly
  // every listing) and a denylist of unit words that follow fabric-weight
  // and material numbers ("220gsm", "600 gsm", "100% cotton").
  const bare = t.match(
    /(?<![a-z0-9%])(\d{3})(?![a-z0-9%])(?!\s*(?:gsm|cm|mm|kg|oz|ml|cotton|poly(?:ester)?|nylon|spandex|denier)\b)/i,
  );
  if (bare) {
    const value = Number(bare[1]);
    if (value >= 100 && value <= 999) return { value, estimate: true };
  }

  return null;
}

/** Back-compat helper for callers that only need the numeric value. */
export function parsePriceCny(text: string): number | null {
  return parsePriceCnyDetailed(text)?.value ?? null;
}

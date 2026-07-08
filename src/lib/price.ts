/**
 * Detect a CNY price in seller-written text. Yupoo album titles carry prices
 * in wildly inconsistent formats: "238 RMB", "¥168", "168元", "rmb299",
 * "Price:158", "350gsm tee 128￥" — this walks the common patterns and
 * returns the first plausible match.
 */
export function parsePriceCny(text: string): number | null {
  const t = text.replace(/[，,]/g, "");

  const patterns = [
    /(?:¥|￥)\s*(\d{1,6}(?:\.\d{1,2})?)/, // ¥168
    /(\d{1,6}(?:\.\d{1,2})?)\s*(?:¥|￥|元)/, // 168¥ / 168元
    /(?:rmb|cny)[\s:：]*(\d{1,6}(?:\.\d{1,2})?)/i, // RMB 238 / rmb:238
    /(\d{1,6}(?:\.\d{1,2})?)\s*(?:rmb|cny)\b/i, // 238 RMB
    /(?:price|价格)[\s:：]*(\d{1,6}(?:\.\d{1,2})?)/i, // Price: 158
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const value = Number(m[1]);
      // Sanity window — rules out sizes (46), years (2026), phone numbers.
      if (value >= 5 && value <= 100000) return value;
    }
  }
  return null;
}

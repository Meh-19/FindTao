export const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "KRW", "SGD", "CHF", "MXN", "BRL", "CNY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export type RateTable = Record<Currency, number>;

/** Static fallback rates (CNY → target), used until the live FX fetch lands or when it fails. */
export const FALLBACK_RATES: RateTable = {
  CNY: 1,
  USD: 0.139,
  EUR: 0.127,
  GBP: 0.109,
  JPY: 21.4,
  CAD: 0.19,
  AUD: 0.21,
  KRW: 191,
  SGD: 0.186,
  CHF: 0.121,
  MXN: 2.55,
  BRL: 0.74,
};

const SYMBOLS: Record<Currency, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
  CAD: "C$",
  AUD: "A$",
  KRW: "₩",
  SGD: "S$",
  CHF: "CHF ",
  MXN: "MX$",
  BRL: "R$",
};

const ZERO_DECIMAL: Currency[] = ["JPY", "KRW"];

export function convertCny(amountCny: number, to: Currency, rates: RateTable = FALLBACK_RATES): number {
  return amountCny * (rates[to] ?? FALLBACK_RATES[to]);
}

export function formatMoney(amount: number, currency: Currency): string {
  const decimals = ZERO_DECIMAL.includes(currency) ? 0 : 2;
  return `${SYMBOLS[currency]}${amount.toFixed(decimals)}`;
}

export function formatCnyWith(
  amountCny: number,
  display: Currency,
  rates: RateTable = FALLBACK_RATES,
): string {
  if (display === "CNY") return formatMoney(amountCny, "CNY");
  return `${formatMoney(amountCny, "CNY")} ≈ ${formatMoney(convertCny(amountCny, display, rates), display)}`;
}

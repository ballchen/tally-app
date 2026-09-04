// Type definition based on the JSON structure
export type CurrencyData = Record<string, {
  Exrate: number
  UTC: string
}>

export const AVAILABLE_CURRENCIES = [
  "TWD", "USD", "JPY", "EUR", "KRW", "CNY", "GBP", "AUD", "HKD", "SGD", "THB", "VND"
] as const

export type CurrencyCode = typeof AVAILABLE_CURRENCIES[number]

export const CURRENCY_SYMBOLS: Record<string, string> = {
  TWD: "NT$",
  USD: "$",
  JPY: "¥",
  EUR: "€",
  KRW: "₩",
  CNY: "¥",
  GBP: "£",
  AUD: "A$",
  HKD: "HK$",
  SGD: "S$",
  THB: "฿",
  VND: "₫"
}

// Currencies that are conventionally shown without fractional units.
const ZERO_DECIMAL_CURRENCIES = new Set(["TWD", "JPY", "KRW", "VND"])

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}

export function getCurrencyDecimals(currencyCode: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2
}

export function formatAmount(amount: number, currencyCode: string, locale?: string): string {
  const decimals = getCurrencyDecimals(currencyCode)
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
  return `${getCurrencySymbol(currencyCode)} ${formatted}`
}

/**
 * Rate from `from` to `to`, via USD cross rate. Returns null when the
 * rates table lacks either leg, so callers can refuse to persist a guess.
 */
export function findExchangeRate(from: string, to: string, rates?: CurrencyData | null): number | null {
  if (from === to) return 1
  if (!rates) return null

  const usdToFrom = rates[`USD${from}`]?.Exrate
  const usdToTo = rates[`USD${to}`]?.Exrate

  if (from === "USD") return usdToTo ?? null
  if (to === "USD") return usdToFrom ? 1 / usdToFrom : null
  if (usdToFrom && usdToTo) return usdToTo / usdToFrom
  return null
}

/** Display-only variant: falls back to 1 so previews never crash. */
export function getExchangeRate(from: string, to: string, rates?: CurrencyData | null): number {
  return findExchangeRate(from, to, rates) ?? 1
}

export function convertAmount(amount: number, from: string, to: string, rates?: CurrencyData | null): number {
  return amount * getExchangeRate(from, to, rates)
}

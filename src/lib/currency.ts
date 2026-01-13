
// Type definition based on the JSON structure
export type CurrencyData = Record<string, {
  Exrate: number
  UTC: string
}>

export const AVAILABLE_CURRENCIES = [
  "TWD", "USD", "JPY", "EUR", "KRW", "CNY", "GBP", "AUD", "HKD", "SGD", "THB", "VND"
] as const

export type CurrencyCode = typeof AVAILABLE_CURRENCIES[number]

/**
 * Currency symbol mapping
 */
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

/**
 * Get currency symbol from currency code
 * Falls back to currency code if symbol not found
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}

/**
 * Get the exchange rate from Source Currency to Target Currency.
 * Logic: (Amount / Rate_USD_to_Source) * Rate_USD_to_Target
 *
 * Example: JPY to TWD
 * 1. JPY to USD: 1 / Rate(USDJPY)
 * 2. USD to TWD: * Rate(USDTWD)
 */
export function getExchangeRate(from: string, to: string, rates?: CurrencyData | null): number {
  if (from === to) return 1
  if (!rates) return 1 // Fallback if rates not loaded

  // Base case: USD to X
  const usdToFrom = rates[`USD${from}`]?.Exrate
  const usdToTo = rates[`USD${to}`]?.Exrate

  // If "from" is USD, we just return the rate for "to" (which is USD->To)
  if (from === "USD") {
    return usdToTo || 1
  }

  // If "to" is USD, we return 1 / (USD->From)
  if (to === "USD") {
    return usdToFrom ? 1 / usdToFrom : 1
  }

  // Cross rate: From -> USD -> To
  if (usdToFrom && usdToTo) {
    // 1 From = (1 / usdToFrom) USD
    // (1 / usdToFrom) USD = (1 / usdToFrom) * usdToTo To
    return usdToTo / usdToFrom
  }

  return 1
}

export function convertAmount(amount: number, from: string, to: string, rates?: CurrencyData | null): number {
  const rate = getExchangeRate(from, to, rates)
  return amount * rate
}

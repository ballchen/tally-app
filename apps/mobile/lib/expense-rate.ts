import { findExchangeRate, type CurrencyData } from '@tally/shared/currency';

export type RateContext = {
  currency: string;
  baseCurrency: string;
  rates: CurrencyData | null | undefined;
  /** The currency and rate stored on the expense being edited, if any. */
  locked?: { currency: string; rate: number | null } | null;
};

/**
 * The rate an expense is saved with. Null means "unknown", and the caller must
 * refuse to save rather than guess: a wrong rate silently corrupts every
 * balance derived from `owed_amount_base`.
 */
export function resolveExchangeRate({
  currency,
  baseCurrency,
  rates,
  locked,
}: RateContext): number | null {
  if (currency === baseCurrency) return 1;
  // Editing without changing the currency keeps the rate captured at creation,
  // so an old expense's base amounts never drift with today's rates.
  if (locked && locked.currency === currency && locked.rate && locked.rate > 0) {
    return locked.rate;
  }
  return findExchangeRate(currency, baseCurrency, rates);
}

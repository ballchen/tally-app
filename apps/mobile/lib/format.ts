import { formatAmount, getCurrencyDecimals, getCurrencySymbol } from '@tally/shared/currency';

import { i18n } from './i18n';

/** `formatAmount` with the locale the app resolved, so JPY/TWD grouping matches the UI language. */
export function formatMoney(amount: number, currency: string): string {
  return formatAmount(amount, currency, i18n.locale);
}

/**
 * Shows a leftover that the currency's own precision would hide — a remaining
 * NT$ 0.40 must not read as "NT$ 0" while the save button stays disabled.
 */
export function formatMoneyExact(amount: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  if (Number(amount.toFixed(decimals)) === amount) return formatMoney(amount, currency);
  return `${getCurrencySymbol(currency)} ${amount.toFixed(decimals + 2)}`;
}

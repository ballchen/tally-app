import { formatAmount } from '@tally/shared/currency';

import { i18n } from './i18n';

/** `formatAmount` with the locale the app resolved, so JPY/TWD grouping matches the UI language. */
export function formatMoney(amount: number, currency: string): string {
  return formatAmount(amount, currency, i18n.locale);
}

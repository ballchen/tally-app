import { format, isToday, isYesterday, type Locale } from 'date-fns';
import { enUS, ja, zhTW } from 'date-fns/locale';

import { i18n, type Locale as AppLocale, type Translate } from './i18n';

const DATE_LOCALES: Record<AppLocale, Locale> = { en: enUS, 'zh-TW': zhTW, ja };

function currentLocale(): Locale {
  return DATE_LOCALES[i18n.locale as AppLocale] ?? enUS;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "September 2026" — the timeline's sticky section header. */
export function formatMonthTitle(value: string | Date): string {
  return format(toDate(value), 'LLLL yyyy', { locale: currentLocale() });
}

/** Month abbreviation for the two-line date column on an expense card. */
export function formatMonthShort(value: string | Date): string {
  return format(toDate(value), 'LLL', { locale: currentLocale() });
}

export function formatDayOfMonth(value: string | Date): string {
  return format(toDate(value), 'd', { locale: currentLocale() });
}

/** Locale-aware medium date, e.g. "Sep 5, 2026". */
export function formatFullDate(value: string | Date): string {
  return format(toDate(value), 'PP', { locale: currentLocale() });
}

export function formatTimeOfDay(value: string | Date): string {
  return format(toDate(value), 'HH:mm', { locale: currentLocale() });
}

/** Today / Yesterday / date — the activity log's day separator. */
export function formatDayLabel(value: string | Date, t: Translate): string {
  const date = toDate(value);
  if (isToday(date)) return t('today');
  if (isYesterday(date)) return t('yesterday');
  return formatFullDate(date);
}

/** Sort key that keeps a month's items together regardless of locale wording. */
export function monthKey(value: string | Date): string {
  return format(toDate(value), 'yyyy-MM');
}

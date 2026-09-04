import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { useMemo } from 'react';

import en from '@tally/shared/messages/en';
import ja from '@tally/shared/messages/ja';
import zhTW from '@tally/shared/messages/zh-TW';

export const SUPPORTED_LOCALES = ['en', 'zh-TW', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const i18n = new I18n({ en, ja, 'zh-TW': zhTW });

i18n.defaultLocale = 'en';
i18n.enableFallback = true;
// The shared messages use next-intl's single-brace syntax, not i18n-js's `{{name}}`.
i18n.placeholder = /\{([^{}]+)\}/g;

function resolveLocale(): Locale {
  for (const { languageTag, languageCode } of getLocales()) {
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === languageTag.toLowerCase());
    if (exact) return exact;
    if (languageCode === 'zh') return 'zh-TW';
    if (languageCode === 'ja') return 'ja';
    if (languageCode === 'en') return 'en';
  }
  return 'en';
}

i18n.locale = resolveLocale();

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: string, values?: TranslateValues) => string;

export function translate(namespace: string, key: string, values?: TranslateValues): string {
  return i18n.t(`${namespace}.${key}`, values);
}

/** Mirrors next-intl's `useTranslations(namespace)` so screen code reads the same on both platforms. */
export function useT(namespace: string): Translate {
  return useMemo(
    () => (key: string, values?: TranslateValues) => translate(namespace, key, values),
    [namespace],
  );
}

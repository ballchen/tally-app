import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { useMemo } from 'react';
import { create } from 'zustand';

import en from '@tally/shared/messages/en';
import ja from '@tally/shared/messages/ja';
import zhTW from '@tally/shared/messages/zh-TW';

export const SUPPORTED_LOCALES = ['en', 'zh-TW', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = 'system' | Locale;

export const LOCALE_PREFERENCES: LocalePreference[] = ['system', 'en', 'zh-TW', 'ja'];

const PREFERENCE_KEY = 'locale-preference';

export const i18n = new I18n({ en, ja, 'zh-TW': zhTW });

i18n.defaultLocale = 'en';
i18n.enableFallback = true;
// The shared messages use next-intl's single-brace syntax, not i18n-js's `{{name}}`.
i18n.placeholder = /\{([^{}]+)\}/g;

function systemLocale(): Locale {
  for (const { languageTag, languageCode } of getLocales()) {
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === languageTag.toLowerCase());
    if (exact) return exact;
    if (languageCode === 'zh') return 'zh-TW';
    if (languageCode === 'ja') return 'ja';
    if (languageCode === 'en') return 'en';
  }
  return 'en';
}

function resolve(preference: LocalePreference): Locale {
  return preference === 'system' ? systemLocale() : preference;
}

type LocaleState = {
  preference: LocalePreference;
  locale: Locale;
  hydrated: boolean;
  setPreference: (preference: LocalePreference) => void;
};

function applyLocale(preference: LocalePreference): Locale {
  const locale = resolve(preference);
  i18n.locale = locale;
  return locale;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  preference: 'system',
  locale: applyLocale('system'),
  hydrated: false,
  setPreference: (preference) => {
    set({ preference, locale: applyLocale(preference) });
    AsyncStorage.setItem(PREFERENCE_KEY, preference);
  },
}));

function isPreference(value: string | null): value is LocalePreference {
  return value !== null && (LOCALE_PREFERENCES as string[]).includes(value);
}

export async function hydrateLocalePreference(): Promise<void> {
  const stored = await AsyncStorage.getItem(PREFERENCE_KEY);
  const preference: LocalePreference = isPreference(stored) ? stored : 'system';
  useLocaleStore.setState({ preference, locale: applyLocale(preference), hydrated: true });
}

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: string, values?: TranslateValues) => string;

export function translate(namespace: string, key: string, values?: TranslateValues): string {
  return i18n.t(`${namespace}.${key}`, values);
}

/** Mirrors next-intl's `useTranslations(namespace)` so screen code reads the same on both platforms. */
export function useT(namespace: string): Translate {
  const locale = useLocaleStore((s) => s.locale);

  // The locale travels through the options so a preference change re-renders every
  // caller instead of leaving stale strings behind.
  return useMemo(
    () => (key: string, values?: TranslateValues) =>
      i18n.t(`${namespace}.${key}`, { ...values, locale }),
    [namespace, locale],
  );
}

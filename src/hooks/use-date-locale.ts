import { useLocale } from "next-intl"
import { enUS, ja, zhTW, type Locale } from "date-fns/locale"

const LOCALES: Record<string, Locale> = { en: enUS, ja, "zh-TW": zhTW }

export function useDateLocale(): Locale {
  return LOCALES[useLocale()] ?? enUS
}

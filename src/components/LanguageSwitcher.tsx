'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const [locale, setLocale] = useState('en');

  useEffect(() => {
     const match = document.cookie.match(new RegExp('(^| )NEXT_LOCALE=([^;]+)'));
     if (match) setLocale(match[2]);
  }, []);

  const handleValueChange = (value: string) => {
    // Set cookie for 1 year
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <Select value={locale} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t('language')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="ja">日本語</SelectItem>
        <SelectItem value="zh-TW">繁體中文</SelectItem>
      </SelectContent>
    </Select>
  );
}

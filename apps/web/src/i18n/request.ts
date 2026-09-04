import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';
import en from '@tally/shared/messages/en';
import ja from '@tally/shared/messages/ja';
import zhTW from '@tally/shared/messages/zh-TW';

const messagesByLocale = {en, ja, 'zh-TW': zhTW} as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'en') as keyof typeof messagesByLocale;

  return {
    locale,
    messages: messagesByLocale[locale] ?? messagesByLocale.en
  };
});

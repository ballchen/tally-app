import { describe, expect, it } from 'vitest';

import en from '@tally/shared/messages/en';
import ja from '@tally/shared/messages/ja';
import zhTW from '@tally/shared/messages/zh-TW';

type Messages = Record<string, unknown>;

function flatten(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Messages, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

// Every VoiceOver label goes through i18n, so a key missing from one locale is
// a control that announces its raw glyph in that language.
const A11Y_KEYS = [
  'Common.back',
  'Common.offline',
  'Common.offlineTitle',
  'Common.offlineBody',
  'Groups.openProfile',
  'CreateGroup.newGroup',
  'GroupDetails.addExpense',
  'GroupDetails.invite',
  'GroupDetails.undoAction',
  'GroupDetails.settlementDetails',
  'GroupDetails.expenseOptionsHint',
  'EditGroup.title',
  'ActivityLog.viewHistory',
  'AddExpense.deleteExpense',
  'Profile.changePhoto',
  'Calculator.backspace',
  'Calculator.clear',
  'Calculator.equals',
  'Calculator.divide',
  'Calculator.multiply',
  'Calculator.subtract',
  'Calculator.add',
  'Calculator.decimal',
];

const LOCALES = { en, 'zh-TW': zhTW, ja } as const;

describe('translation messages', () => {
  const keys = Object.fromEntries(
    Object.entries(LOCALES).map(([locale, messages]) => [
      locale,
      flatten(messages as Messages).sort(),
    ]),
  );

  it.each(['zh-TW', 'ja'] as const)('%s has the same keys as en', (locale) => {
    expect(keys[locale]).toEqual(keys.en);
  });

  it.each(Object.keys(LOCALES))('%s defines every accessibility label', (locale) => {
    const missing = A11Y_KEYS.filter((key) => !keys[locale].includes(key));
    expect(missing).toEqual([]);
  });

  it.each(Object.entries(LOCALES))('%s has no blank strings', (_locale, messages) => {
    const flat = flatten(messages as Messages);
    const blank = flat.filter((key) => {
      const value = key
        .split('.')
        .reduce<unknown>((node, part) => (node as Messages)[part], messages);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blank).toEqual([]);
  });
});

import { AVAILABLE_CURRENCIES, findExchangeRate } from '@tally/shared/currency';
import { useExchangeRates } from '@tally/shared/queries/exchange-rates';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { initialState, reduce, tokenFor, type CalculatorState } from '@/lib/calculator';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export type CalculatorProps = {
  currency: string;
  baseCurrency: string;
  onCurrencyChange: (currency: string) => void;
  initialValue?: number;
  confirmLabel: string;
  onConfirm: (amount: number) => void;
};

const KEYPAD = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '⌫', '+'],
] as const;

const OPERATORS = new Set(['÷', '×', '−', '+']);
const KEY_HEIGHT = 56;

/** Regex-safe test ids: Maestro matches ids as regexes, where "+" and "." are syntax. */
const KEY_ID: Record<string, string> = {
  '÷': 'divide',
  '×': 'times',
  '−': 'minus',
  '+': 'plus',
  '.': 'dot',
  '⌫': 'backspace',
  C: 'clear',
  '=': 'equals',
};

function keyTestID(label: string): string {
  return `calc-key-${KEY_ID[label] ?? label}`;
}

/** Shrinks the amount so a long result still fits on one line. */
function fontSizeFor(text: string, base: number): number {
  if (text.length <= 7) return base;
  if (text.length <= 9) return base * 0.8;
  if (text.length <= 12) return base * 0.65;
  return base * 0.5;
}

export function Calculator({
  currency,
  baseCurrency,
  onCurrencyChange,
  initialValue,
  confirmLabel,
  onConfirm,
}: CalculatorProps) {
  const theme = useTheme();
  const t = useT('Calculator');
  const [state, setState] = useState<CalculatorState>(() => initialState(initialValue));
  const rates = useExchangeRates();

  const press = (key: string) => {
    const token = tokenFor(key);
    if (!token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((previous) => reduce(previous, token));
  };

  const openCurrencyPicker = () => {
    const options = [...AVAILABLE_CURRENCIES];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('selectCurrency'),
        options: [...options, t('cancel')],
        cancelButtonIndex: options.length,
        userInterfaceStyle: theme.scheme,
      },
      (index) => {
        if (index < options.length) onCurrencyChange(options[index]);
      },
    );
  };

  const rate = useMemo(
    () => findExchangeRate(currency, baseCurrency, rates.data),
    [currency, baseCurrency, rates.data],
  );
  const crossCurrency = currency !== baseCurrency;
  const display = state.error ? t('error') : state.display;
  // Confirming an unfinished expression ("120 + 30") should use its result,
  // not the last operand the user happened to be typing.
  const settled = useMemo(() => reduce(state, { kind: 'equals' }), [state]);
  const confirmable = !settled.error && settled.value > 0;

  const keyStyle = (label: string) => ({
    flex: 1,
    height: KEY_HEIGHT,
    borderRadius: theme.radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: OPERATORS.has(label) ? theme.colors.primarySoft : theme.colors.surface,
  });

  const key = (label: string, testID: string, a11yLabel?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      testID={testID}
      onPress={() => press(label)}
      style={keyStyle(label)}
    >
      <Text variant="title2" color={OPERATORS.has(label) ? 'primary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text
          variant="footnote"
          color="textSecondary"
          numberOfLines={1}
          testID="calculator-expression"
          style={{ textAlign: 'right', minHeight: 18 }}
        >
          {state.expression}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('currency')}
            testID="calculator-currency"
            onPress={openCurrencyPicker}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <Text variant="headline" color="primary">
              {currency} ⌄
            </Text>
          </Pressable>

          <Text
            variant="amountXL"
            color={state.error ? 'negative' : 'text'}
            numberOfLines={1}
            testID="calculator-display"
            style={{
              flex: 1,
              textAlign: 'right',
              fontSize: fontSizeFor(display, theme.typography.amountXL.fontSize),
            }}
          >
            {display}
          </Text>
        </View>

        {crossCurrency ? (
          rate == null ? (
            <Text
              variant="footnote"
              color="warning"
              testID="calculator-rate-missing"
              style={{ textAlign: 'right' }}
            >
              {t('rateUnavailable')}
            </Text>
          ) : (
            <Text
              variant="footnote"
              color="textSecondary"
              testID="calculator-converted"
              style={{ textAlign: 'right' }}
            >
              {t('convertedTo', { amount: formatMoney(state.value * rate, baseCurrency) })} (
              {`1 ${currency} = ${rate.toFixed(4)} ${baseCurrency}`})
            </Text>
          )
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {KEYPAD.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {row.map((label) =>
              key(label, keyTestID(label), label === '⌫' ? t('backspace') : undefined),
            )}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('clear')}
            testID={keyTestID('C')}
            onPress={() => press('C')}
            style={[keyStyle('C'), { flex: 2, backgroundColor: theme.colors.primarySoft }]}
          >
            <Text variant="title2" color="negative">
              C
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('equals')}
            testID={keyTestID('=')}
            onPress={() => press('=')}
            style={[keyStyle('='), { flex: 2, backgroundColor: theme.colors.primary }]}
          >
            <Text variant="title2" color="onPrimary">
              =
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <Button
        testID="calculator-confirm"
        size="lg"
        title={confirmLabel}
        disabled={!confirmable}
        onPress={() => onConfirm(settled.value)}
      />
    </View>
  );
}

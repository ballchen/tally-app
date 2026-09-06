import { AVAILABLE_CURRENCIES, getCurrencySymbol } from '@tally/shared/currency';
import { ActionSheetIOS, Pressable, View } from 'react-native';

import { Text } from './Text';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export type CurrencyFieldProps = {
  label: string;
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
  hint?: string;
  testID?: string;
};

export function CurrencyField({
  label,
  value,
  onChange,
  disabled = false,
  hint,
  testID,
}: CurrencyFieldProps) {
  const theme = useTheme();
  const t = useT('EditGroup');

  const open = () => {
    const options = [...AVAILABLE_CURRENCIES];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: [...options, t('cancel')],
        cancelButtonIndex: options.length,
        userInterfaceStyle: theme.scheme,
      },
      (index) => {
        if (index < options.length) onChange(options[index]);
      },
    );
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="subhead" color="textSecondary">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        testID={testID}
        disabled={disabled}
        onPress={open}
        style={{
          height: 48,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text variant="body">
          {value} {getCurrencySymbol(value)}
        </Text>
        <Text variant="body" color="textSecondary">
          ⌄
        </Text>
      </Pressable>
      {hint ? (
        <Text variant="footnote" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

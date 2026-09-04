import { useId, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { useT } from '@/lib/i18n';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({ label, error, containerStyle, onFocus, onBlur, style, ...rest }: InputProps) {
  const theme = useTheme();
  const t = useT('Common');
  const [focused, setFocused] = useState(false);
  const accessoryId = useId();

  const borderColor = error
    ? theme.colors.negative
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="subhead" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textSecondary}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        style={[
          {
            height: 48,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: focused || error ? 2 : 1,
            borderColor,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            fontSize: theme.typography.body.fontSize,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="footnote" color="negative">
          {error}
        </Text>
      ) : null}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              backgroundColor: theme.colors.surfaceElevated,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <Button
              variant="ghost"
              size="md"
              title={t('done')}
              onPress={() => Keyboard.dismiss()}
            />
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

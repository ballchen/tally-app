import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type HeaderButtonProps = {
  /** Either a word or a glyph; ignored when `symbol` is given. */
  title?: string;
  /** SF Symbol drawn instead of `title`. Needs `accessibilityLabel` to be readable. */
  symbol?: SFSymbol;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  destructive?: boolean;
  /** Overrides the a11y label when `title` is a glyph (e.g. "‹") rather than a word. */
  accessibilityLabel?: string;
};

const SYMBOL_SIZE = 20;

export function HeaderButton({
  title,
  symbol,
  onPress,
  testID,
  disabled = false,
  destructive = false,
  accessibilityLabel,
}: HeaderButtonProps) {
  const theme = useTheme();
  // Header buttons float over the group cover photo; the primary tint reads
  // fine on light artwork but loses contrast against dark photos and the
  // dark theme's background, so dark mode gets an opaque capsule instead.
  const isDark = theme.scheme === 'dark';
  const tint = destructive
    ? theme.colors.negative
    : isDark
      ? theme.colors.text
      : theme.colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={{
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: isDark ? theme.spacing.md : theme.spacing.xs,
        paddingVertical: isDark ? theme.spacing.xs : 0,
        borderRadius: theme.radius.full,
        backgroundColor: isDark ? theme.colors.surfaceElevated : 'transparent',
      }}
    >
      {symbol ? (
        <SymbolView
          name={symbol}
          size={SYMBOL_SIZE}
          tintColor={tint}
          resizeMode="scaleAspectFit"
          // Keeps the capsule the same height as its text-only siblings.
          style={{ height: theme.typography.body.fontSize + 5, width: SYMBOL_SIZE }}
        />
      ) : (
        <Text variant="body" color={destructive ? 'negative' : isDark ? 'text' : 'primary'}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

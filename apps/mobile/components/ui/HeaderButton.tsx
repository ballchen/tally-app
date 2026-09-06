import { Pressable } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type HeaderButtonProps = {
  title: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  destructive?: boolean;
  /** Overrides the a11y label when `title` is a glyph (e.g. "‹") rather than a word. */
  accessibilityLabel?: string;
};

export function HeaderButton({
  title,
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
        paddingHorizontal: isDark ? theme.spacing.md : theme.spacing.xs,
        paddingVertical: isDark ? theme.spacing.xs : 0,
        borderRadius: theme.radius.full,
        backgroundColor: isDark ? theme.colors.surfaceElevated : 'transparent',
      }}
    >
      <Text variant="body" color={destructive ? 'negative' : isDark ? 'text' : 'primary'}>
        {title}
      </Text>
    </Pressable>
  );
}

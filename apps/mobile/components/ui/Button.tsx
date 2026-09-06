import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import type { ColorToken } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg' | 'icon';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number }> = {
  md: { height: 44, paddingHorizontal: 16 },
  lg: { height: 52, paddingHorizontal: 20 },
  icon: { height: 44, paddingHorizontal: 0 },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(1));

  const animate = useCallback(
    (to: number) => {
      Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40 }).start();
    },
    [scale],
  );

  const palettes: Record<ButtonVariant, { background: string; label: ColorToken; border?: string }> =
    {
      primary: { background: theme.colors.primary, label: 'onPrimary' },
      secondary: { background: theme.colors.primarySoft, label: 'primary' },
      ghost: { background: 'transparent', label: 'primary' },
      destructive: { background: theme.colors.negative, label: 'onPrimary' },
    };
  const look = palettes[variant];
  const isBlocked = Boolean(disabled) || loading;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked, busy: loading }}
        disabled={isBlocked}
        onPressIn={(e) => {
          animate(0.97);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animate(1);
          onPressOut?.(e);
        }}
        onPress={onPress}
        style={{
          height: SIZES[size].height,
          paddingHorizontal: SIZES[size].paddingHorizontal,
          minWidth: size === 'icon' ? SIZES.icon.height : undefined,
          borderRadius: theme.radius.md,
          backgroundColor: look.background,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: theme.spacing.sm,
          opacity: isBlocked ? 0.5 : 1,
        }}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors[look.label]} />
        ) : (
          (children ?? (
            <Text variant="headline" color={look.label}>
              {title}
            </Text>
          ))
        )}
      </Pressable>
    </Animated.View>
  );
}

import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type FabProps = {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  icon?: string;
  /** 1 = full size, shrinks toward 0 while the caller's list is actively scrolling, so the FAB stops covering card content mid-scroll. */
  collapseScale?: Animated.Value;
};

const SIZE = 56;
const COLLAPSED_SCALE = 0.62;

export function Fab({ onPress, accessibilityLabel, testID, icon = '+', collapseScale }: FabProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pressScale] = useState(() => new Animated.Value(1));

  const animate = useCallback(
    (to: number) =>
      Animated.spring(pressScale, { toValue: to, useNativeDriver: true, speed: 40 }).start(),
    [pressScale],
  );

  const scale = collapseScale
    ? Animated.multiply(
        pressScale,
        collapseScale.interpolate({
          inputRange: [0, 1],
          outputRange: [COLLAPSED_SCALE, 1],
          extrapolate: 'clamp',
        }),
      )
    : pressScale;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: theme.screenPadding,
        bottom: insets.bottom + theme.spacing.lg,
        transform: [{ scale }],
        shadowColor: '#1C1C2E',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPressIn={() => {
          animate(0.94);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onPressOut={() => animate(1)}
        onPress={onPress}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="largeTitle" color="onPrimary" style={{ lineHeight: 38 }}>
          {icon}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

export const COVER_HEIGHT = 220;

/** Extra artwork below the clipping window, so the parallax never exposes a gap. */
const OVERDRAW = COVER_HEIGHT * 0.5;

export type GroupCoverProps = {
  name: string;
  coverUrl: string | null;
  archivedLabel: string | null;
  scrollY: Animated.Value;
};

/** Cover artwork that drifts at roughly half the list's scroll speed. */
export function GroupCover({ name, coverUrl, archivedLabel, scrollY }: GroupCoverProps) {
  const theme = useTheme();

  const translateY = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT],
    outputRange: [0, OVERDRAW],
    extrapolate: 'clamp',
  });
  const scale = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [1.8, 1],
    extrapolateRight: 'clamp',
  });

  return (
    <View style={{ height: COVER_HEIGHT, overflow: 'hidden', backgroundColor: theme.colors.primarySoft }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: COVER_HEIGHT + OVERDRAW,
          transform: [{ translateY }, { scale }],
        }}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ flex: 1 }}
            contentFit="cover"
            testID="group-cover"
          />
        ) : (
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.settlement]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
            testID="group-cover"
          />
        )}
      </Animated.View>

      <View
        style={{
          position: 'absolute',
          left: theme.screenPadding,
          right: theme.screenPadding,
          bottom: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
        }}
      >
        <BlurView
          intensity={theme.blurIntensity}
          tint={theme.scheme}
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.xs,
          }}
        >
          <Text variant="title1" numberOfLines={2} testID="group-name-heading">
            {name}
          </Text>
          {archivedLabel ? (
            <Text variant="footnote" color="warning" testID="group-archived-badge">
              {archivedLabel}
            </Text>
          ) : null}
        </BlurView>
      </View>
    </View>
  );
}

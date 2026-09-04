import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type AvatarSize = 20 | 28 | 40 | 64;

export type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: AvatarSize;
};

const FONT_VARIANT = {
  20: 'caption',
  28: 'footnote',
  40: 'headline',
  64: 'title2',
} as const;

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ?? undefined}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text variant={FONT_VARIANT[size]} color="primary">
          {initial}
        </Text>
      )}
    </View>
  );
}

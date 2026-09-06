import { View } from 'react-native';

import { Avatar, type AvatarSize } from './Avatar';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type StackedMember = { id: string; name: string | null; avatarUrl: string | null };

export type AvatarStackProps = {
  members: StackedMember[];
  max?: number;
  size?: AvatarSize;
};

export function AvatarStack({ members, max = 3, size = 28 }: AvatarStackProps) {
  const theme = useTheme();
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((member, index) => (
        <View
          key={member.id}
          style={{
            marginLeft: index === 0 ? 0 : -size / 3,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        >
          <Avatar uri={member.avatarUrl} name={member.name} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <Text variant="footnote" color="textSecondary" style={{ marginLeft: theme.spacing.xs }}>
          +{overflow}
        </Text>
      ) : null}
    </View>
  );
}

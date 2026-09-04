import type { GroupMember } from '@tally/shared/members';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

export type MemberStripProps = {
  members: GroupMember[];
  inviteLabel: string;
  onInvite: () => void;
};

const ITEM_WIDTH = 64;

export function memberDisplayName(member: GroupMember): string {
  return member.group_nickname ?? member.profiles.display_name ?? '';
}

export function MemberStrip({ members, inviteLabel, onInvite }: MemberStripProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.md, alignItems: 'flex-start' }}
    >
      {members.map((member) => (
        <View key={member.user_id} style={{ width: ITEM_WIDTH, alignItems: 'center', gap: theme.spacing.xs }}>
          <Avatar
            uri={member.group_avatar_url ?? member.profiles.avatar_url}
            name={memberDisplayName(member)}
            size={40}
          />
          <Text variant="caption" numberOfLines={1} style={{ maxWidth: ITEM_WIDTH }}>
            {memberDisplayName(member)}
          </Text>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={inviteLabel}
        testID="invite-member"
        onPress={onInvite}
        style={{ width: ITEM_WIDTH, alignItems: 'center', gap: theme.spacing.xs }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="headline" color="primary">
            +
          </Text>
        </View>
        <Text variant="caption" color="primary" numberOfLines={1}>
          {inviteLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

import type { GroupListItem } from '@tally/shared/queries/groups';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { AvatarStack } from '@/components/ui/AvatarStack';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/useTheme';
import type { ColorToken } from '@/theme/tokens';

export type GroupCardProps = {
  group: GroupListItem;
  balance: number | undefined;
  onPress: () => void;
  /** VoiceOver cannot perform the row's swipe, so its actions come through here. */
  swipeActions?: { name: string; run: () => void }[];
};

const THUMB = 56;

/** Balances below one cent are noise from base-currency rounding, not a real debt. */
const SETTLED_EPSILON = 0.01;

function useBalanceLabel(group: GroupListItem, balance: number | undefined) {
  const t = useT('GroupDetails');

  if (balance === undefined) return null;

  const color: ColorToken =
    Math.abs(balance) < SETTLED_EPSILON ? 'textSecondary' : balance > 0 ? 'positive' : 'negative';

  const text =
    Math.abs(balance) < SETTLED_EPSILON
      ? t('youAreSettled')
      : balance > 0
        ? t('youAreOwed', { amount: formatMoney(balance, group.base_currency) })
        : t('youOwe', { amount: formatMoney(-balance, group.base_currency) });

  return { text, color };
}

export function GroupCard({ group, balance, onPress, swipeActions = [] }: GroupCardProps) {
  const theme = useTheme();
  const t = useT('Groups');
  const [scale] = useState(() => new Animated.Value(1));
  const balanceLabel = useBalanceLabel(group, balance);

  const animate = useCallback(
    (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40 }).start(),
    [scale],
  );

  const memberCount = group.all_members.length;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityActions={swipeActions.map(({ name }) => ({ name }))}
        onAccessibilityAction={({ nativeEvent }) =>
          swipeActions.find((a) => a.name === nativeEvent.actionName)?.run()
        }
        testID={`group-card-${group.id}`}
        onPressIn={() => {
          animate(0.98);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => animate(1)}
        onPress={onPress}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.md,
          },
          theme.shadow,
        ]}
      >
        <View style={{ width: THUMB, height: THUMB, borderRadius: theme.radius.md, overflow: 'hidden' }}>
          {group.cover_image_url ? (
            <Image
              source={{ uri: group.cover_image_url }}
              style={{ width: THUMB, height: THUMB }}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.settlement]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="title2" color="onPrimary">
                {group.name.trim().charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="headline" numberOfLines={1}>
            {group.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <AvatarStack
              members={group.all_members.map((m) => ({
                id: m.user_id,
                name: m.group_nickname ?? m.profiles.display_name,
                avatarUrl: m.group_avatar_url ?? m.profiles.avatar_url,
              }))}
            />
            <Text variant="footnote" color="textSecondary">
              {memberCount} {t(memberCount === 1 ? 'member' : 'members')}
            </Text>
          </View>
          {balanceLabel ? (
            <Text variant="amountM" color={balanceLabel.color}>
              {balanceLabel.text}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

import SegmentedControl from '@react-native-segmented-control/segmented-control';
import type { GroupFilter, GroupListItem } from '@tally/shared/queries/groups';
import {
  useArchiveGroup,
  useGroups,
  useHideGroup,
  useMyGroupBalances,
} from '@tally/shared/queries/groups';
import { useProfile } from '@tally/shared/queries/profile';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { GroupRow, type SwipeAction } from '@/components/groups/GroupRow';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { usePushPrompt } from '@/lib/push';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

type ListFilter = Extract<GroupFilter, 'active' | 'archived' | 'hidden'>;

/** Keeps the last card clear of the floating action button. */
const LIST_BOTTOM_INSET = 120;

const FILTERS: ListFilter[] = ['active', 'archived', 'hidden'];

const EMPTY_COPY: Record<ListFilter, { title: string; description: string }> = {
  active: { title: 'noGroups', description: 'createFirst' },
  archived: { title: 'noArchived', description: 'archivedDesc' },
  hidden: { title: 'noHidden', description: 'hiddenDesc' },
};

export default function GroupsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Groups');
  const tEdit = useT('EditGroup');
  const tCreate = useT('CreateGroup');
  const tPush = useT('Push');
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfile();
  const pushPrompt = usePushPrompt(Boolean(userId));

  const [filterIndex, setFilterIndex] = useState(0);
  const filter = FILTERS[filterIndex];

  const groups = useGroups(filter);
  const balances = useMyGroupBalances();
  const hideGroup = useHideGroup();
  const archiveGroup = useArchiveGroup();

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([groups.refetch(), balances.refetch()]);
    setRefreshing(false);
  }, [groups, balances]);

  const runAction = useCallback(
    async (promise: Promise<unknown>, successKey: string, errorKey: string) => {
      try {
        await promise;
        showToast({ type: 'success', title: tEdit(`success.${successKey}`) });
      } catch (error) {
        showToast({ type: 'error', title: tEdit(`error.${errorKey}`), message: errorMessage(error) });
      }
    },
    [tEdit],
  );

  const actionsFor = useCallback(
    (group: GroupListItem): SwipeAction[] => {
      const hidden = group.group_members.some((m) => m.user_id === userId && m.hidden_at);
      const archived = Boolean(group.archived_at);
      const isOwner = group.created_by === userId;

      const actions: SwipeAction[] = [
        {
          key: hidden ? 'unhide' : 'hide',
          label: hidden ? tEdit('unhide') : tEdit('hide'),
          color: 'warning',
          confirm: {
            message: hidden ? tEdit('unhideDesc') : tEdit('hideDesc'),
            confirmLabel: hidden ? tEdit('confirmUnhide') : tEdit('confirmHide'),
            cancelLabel: tEdit('cancel'),
          },
          onPress: () =>
            runAction(
              hideGroup.mutateAsync({ groupId: group.id, hide: !hidden }),
              hidden ? 'unhidden' : 'hidden',
              hidden ? 'unhide' : 'hide',
            ),
        },
      ];

      if (isOwner) {
        actions.push({
          key: archived ? 'unarchive' : 'archive',
          label: archived ? tEdit('unarchive') : tEdit('archive'),
          color: 'settlement',
          confirm: {
            message: archived ? tEdit('unarchiveDesc') : tEdit('archiveDesc'),
            confirmLabel: archived ? tEdit('confirmUnarchive') : tEdit('confirmArchive'),
            cancelLabel: tEdit('cancel'),
          },
          onPress: () =>
            runAction(
              archiveGroup.mutateAsync({ groupId: group.id, archive: !archived }),
              archived ? 'unarchived' : 'archived',
              archived ? 'unarchive' : 'archive',
            ),
        });
      }

      return actions;
    },
    [userId, tEdit, runAction, hideGroup, archiveGroup],
  );

  const header = useMemo(
    () => (
      <View style={{ paddingBottom: theme.spacing.lg, gap: theme.spacing.lg }}>
        {pushPrompt.visible ? (
          <Surface testID="push-prompt" style={{ gap: theme.spacing.sm }}>
            <Text variant="headline">{tPush('promptTitle')}</Text>
            <Text variant="subhead" color="textSecondary">
              {tPush('promptBody')}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Button
                testID="push-prompt-enable"
                title={tPush('enable')}
                style={{ flex: 1 }}
                onPress={pushPrompt.enable}
              />
              <Button
                testID="push-prompt-later"
                variant="ghost"
                title={tPush('later')}
                onPress={pushPrompt.dismiss}
              />
            </View>
          </Surface>
        ) : null}
        <SegmentedControl
          testID="groups-filter"
          values={[t('active'), t('archived'), t('hidden')]}
          selectedIndex={filterIndex}
          onChange={(event) => setFilterIndex(event.nativeEvent.selectedSegmentIndex)}
          appearance={theme.scheme}
        />
      </View>
    ),
    [filterIndex, t, tPush, theme, pushPrompt],
  );

  const empty = groups.isLoading ? (
    <View style={{ gap: theme.spacing.md }}>
      <Skeleton height={80} radius={theme.radius.lg} />
      <Skeleton height={80} radius={theme.radius.lg} />
      <Skeleton height={80} radius={theme.radius.lg} />
    </View>
  ) : (
    <View style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl }}>
      <Text variant="title2">{t(EMPTY_COPY[filter].title)}</Text>
      <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
        {t(EMPTY_COPY[filter].description)}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[t('openProfile'), profile.data?.display_name]
                .filter(Boolean)
                .join(', ')}
              testID="open-profile"
              hitSlop={12}
              onPress={() => router.push('/profile')}
            >
              <Avatar
                uri={profile.data?.avatar_url}
                name={profile.data?.display_name}
                size={28}
              />
            </Pressable>
          ),
        }}
      />
      <FlatList
        testID="groups-list"
        contentInsetAdjustmentBehavior="automatic"
        data={groups.data ?? []}
        keyExtractor={(group) => group.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          paddingHorizontal: theme.screenPadding,
          paddingBottom: LIST_BOTTOM_INSET,
          gap: theme.spacing.md,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <GroupRow
            group={item}
            balance={balances.data?.[item.id]}
            actions={actionsFor(item)}
            onPress={() => router.push(`/groups/${item.id}`)}
          />
        )}
      />
      <Fab
        testID="new-group-fab"
        accessibilityLabel={tCreate('newGroup')}
        onPress={() => router.push('/groups/new')}
      />
    </View>
  );
}

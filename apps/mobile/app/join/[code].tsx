import { sendPush } from '@tally/shared/lib/push';
import { useGroupByInviteCode, useGroups, useJoinGroup } from '@tally/shared/queries/groups';
import { useSupabase } from '@tally/shared/supabase-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function JoinGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = useSupabase();
  const t = useT('JoinGroup');
  const { code } = useLocalSearchParams<{ code: string }>();

  const invite = useGroupByInviteCode(code);
  const myGroups = useGroups('all');
  const joinGroup = useJoinGroup();

  const group = invite.data;
  const alreadyMember = Boolean(group && myGroups.data?.some((g) => g.id === group.id));

  useEffect(() => {
    if (group && alreadyMember) router.replace(`/groups/${group.id}`);
  }, [group, alreadyMember, router]);

  const join = async () => {
    if (!group) return;

    try {
      const result = await joinGroup.mutateAsync({ groupId: group.id });

      if (result.alreadyMember) {
        showToast({ type: 'info', title: t('alreadyMember') });
      } else {
        showToast({ type: 'success', title: t('joined', { name: group.name }) });

        if (result.existingMemberIds.length > 0) {
          sendPush(supabase, {
            userIds: result.existingMemberIds,
            groupId: group.id,
            title: t('pushTitle'),
            body: t('pushBody', { name: result.joinerName || 'Someone', group: group.name }),
            url: `/groups/${group.id}`,
          });
        }
      }

      router.replace(`/groups/${group.id}`);
    } catch (error) {
      showToast({ type: 'error', title: t('joinFailed'), message: errorMessage(error) });
    }
  };

  if (invite.isLoading || myGroups.isLoading || alreadyMember) {
    return (
      <Screen center>
        <ActivityIndicator testID="join-loading" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (invite.isError || !group) {
    return (
      <Screen center>
        <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          <Text variant="title1">{t('oops')}</Text>
          <Text variant="subhead" color="textSecondary" testID="join-error">
            {t('notFound')}
          </Text>
        </View>
        <Button variant="secondary" title={t('goHome')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen center>
      <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text variant="title1">{t('title')}</Text>
        <Text variant="subhead" color="textSecondary">
          {t('invited')}
        </Text>
      </View>
      <Surface style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text variant="title2" testID="join-group-name">
          {group.name}
        </Text>
        <Text variant="subhead" color="textSecondary" testID="join-group-currency">
          {t('baseCurrency')}: {group.base_currency}
        </Text>
      </Surface>
      <Button
        testID="join-submit"
        size="lg"
        title={t('join')}
        loading={joinGroup.isPending}
        onPress={join}
      />
    </Screen>
  );
}

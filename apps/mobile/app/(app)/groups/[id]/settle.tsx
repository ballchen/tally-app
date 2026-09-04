import { useBalances } from '@tally/shared/queries/balances';
import { useGroupDetails } from '@tally/shared/queries/group-details';
import { useSettleUp } from '@tally/shared/queries/settlements';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { memberDisplayName } from '@/components/groups/MemberStrip';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SheetHeader } from '@/components/ui/SheetHeader';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function SettleAllScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('SettleUp');
  const tGroup = useT('GroupDetails');
  const { id } = useLocalSearchParams<{ id: string }>();

  const details = useGroupDetails(id);
  const settleUp = useSettleUp();

  const members = details.data?.members ?? [];
  const baseCurrency = details.data?.group.base_currency ?? 'TWD';
  const { debts } = useBalances(details.data?.expenses, members, baseCurrency);

  const nameOf = (memberId: string) => {
    const member = members.find((m) => m.user_id === memberId);
    return member ? memberDisplayName(member) : '';
  };
  const avatarOf = (memberId: string) => {
    const member = members.find((m) => m.user_id === memberId);
    return member ? (member.group_avatar_url ?? member.profiles.avatar_url) : null;
  };

  const confirm = async () => {
    try {
      await settleUp.mutateAsync({
        groupId: id,
        repayments: debts.map((debt) => ({ from: debt.from, to: debt.to, amount: debt.amount })),
        repaymentNames: debts.map((debt) => ({
          fromName: nameOf(debt.from),
          toName: nameOf(debt.to),
          amount: debt.amount,
          currency: baseCurrency,
        })),
      });
      router.back();
      showToast({ type: 'success', title: t('settlementRecorded') });
    } catch (error) {
      showToast({ type: 'error', title: t('settlementFailed'), message: errorMessage(error) });
    }
  };

  return (
    <>
      <SheetHeader
        title={t('title')}
        closeLabel={tGroup('cancel')}
        onClose={() => router.back()}
      />
      <Screen>
        <Text variant="subhead" color="textSecondary">
          {t('description')}
        </Text>

        <Surface style={{ gap: theme.spacing.lg }} testID="settle-all-plan">
          {debts.length === 0 ? (
            <Text variant="subhead" color="textSecondary">
              {t('allSettled')}
            </Text>
          ) : (
            debts.map((debt) => (
              <View
                key={`${debt.from}-${debt.to}`}
                testID={`settle-plan-${debt.from}-${debt.to}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
              >
                <Avatar uri={avatarOf(debt.from)} name={nameOf(debt.from)} size={28} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline" numberOfLines={1}>
                    {nameOf(debt.from)}
                  </Text>
                  <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                    {t('pays')} {nameOf(debt.to)}
                  </Text>
                </View>
                <Text variant="amountM">{formatMoney(debt.amount, baseCurrency)}</Text>
              </View>
            ))
          )}
        </Surface>

        <Text variant="footnote" color="textSecondary">
          {t('marksAsSettled')}
        </Text>

        <Button
          testID="confirm-settle-all"
          title={settleUp.isPending ? t('settling') : t('settleAll')}
          disabled={debts.length === 0}
          loading={settleUp.isPending}
          onPress={confirm}
        />
      </Screen>
    </>
  );
}

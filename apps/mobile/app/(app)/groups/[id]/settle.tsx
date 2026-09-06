import { calculateBalances, type Debt } from '@tally/shared/balances';
import { useExchangeRates } from '@tally/shared/queries/exchange-rates';
import { useGroupDetails, type GroupDetails } from '@tally/shared/queries/group-details';
import { useSettleUp, useUndoSettlement } from '@tally/shared/queries/settlements';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

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

const UNDO_WINDOW_MS = 5000;

export default function SettleAllScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('SettleUp');
  const tGroup = useT('GroupDetails');
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const details = useGroupDetails(id);
  const { data: rates } = useExchangeRates();
  const settleUp = useSettleUp();
  const undoSettlement = useUndoSettlement();

  const members = details.data?.members ?? [];
  const baseCurrency = details.data?.group.base_currency ?? 'TWD';
  const { debts } = calculateBalances(details.data?.expenses ?? [], members, baseCurrency, rates);

  const nameOf = (memberId: string) => {
    const member = members.find((m) => m.user_id === memberId);
    return member ? memberDisplayName(member) : '';
  };
  const avatarOf = (memberId: string) => {
    const member = members.find((m) => m.user_id === memberId);
    return member ? (member.group_avatar_url ?? member.profiles.avatar_url) : null;
  };

  const runUndo = async (settlementId: string) => {
    try {
      await undoSettlement.mutateAsync({ settlementId, groupId: id });
      showToast({ type: 'success', title: t('settlementUndone') });
    } catch (error) {
      showToast({ type: 'error', title: t('undoFailed'), message: errorMessage(error) });
    }
  };

  const submit = async (freshDebts: Debt[]) => {
    try {
      // The RPC returns the settlement it created; never infer it from the
      // cache, another member's settlement could be newer.
      const settlementId = await settleUp.mutateAsync({
        groupId: id,
        repayments: freshDebts.map((debt) => ({ from: debt.from, to: debt.to, amount: debt.amount })),
        repaymentNames: freshDebts.map((debt) => ({
          fromName: nameOf(debt.from),
          toName: nameOf(debt.to),
          amount: debt.amount,
          currency: baseCurrency,
        })),
      });

      router.back();
      showToast({
        type: 'success',
        title: t('settlementRecorded'),
        durationMs: UNDO_WINDOW_MS,
        action: settlementId ? { label: tGroup('undo'), onPress: () => runUndo(settlementId) } : undefined,
      });
    } catch (error) {
      showToast({ type: 'error', title: t('settlementFailed'), message: errorMessage(error) });
    }
  };

  const confirm = () => {
    Alert.alert(t('confirmTitle'), t('confirmMessage', { count: debts.length }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: () => {
          // Re-derive from the query cache rather than the `debts` this
          // closure captured when the alert was raised: the sheet can sit
          // open (and the cache can change underneath it) for a while before
          // the user taps confirm, and the Alert button holds whatever
          // closure existed at that moment, not the latest render's.
          const cached = queryClient.getQueryData<GroupDetails>(['group', id]);
          const freshMembers = cached?.members ?? members;
          const freshExpenses = cached?.expenses ?? details.data?.expenses ?? [];
          const { debts: freshDebts } = calculateBalances(freshExpenses, freshMembers, baseCurrency, rates);
          submit(freshDebts);
        },
      },
    ]);
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

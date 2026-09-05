import { useExpense } from '@tally/shared/queries/expenses';
import { useGroupDetails } from '@tally/shared/queries/group-details';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { memberDisplayName } from '@/components/groups/MemberStrip';
import { Avatar } from '@/components/ui/Avatar';
import { HeaderButton } from '@/components/ui/HeaderButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { formatFullDate, formatTimeOfDay } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function ExpenseDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('ExpenseDetail');
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();

  const details = useGroupDetails(id);
  const expense = useExpense(expenseId);

  const baseCurrency = details.data?.group.base_currency ?? 'TWD';
  const isArchived = Boolean(details.data?.group.archived_at);
  const members = details.data?.members ?? [];

  const nameOf = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member ? memberDisplayName(member) : '';
  };
  const avatarOf = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member ? (member.group_avatar_url ?? member.profiles.avatar_url) : null;
  };

  const header = (
    <Stack.Screen
      options={{
        title: t('title'),
        headerRight: () =>
          isArchived || !expense.data ? null : (
            <HeaderButton
              testID="expense-detail-edit"
              title={t('edit')}
              onPress={() => router.push(`/groups/${id}/expense/${expenseId}/edit`)}
            />
          ),
      }}
    />
  );

  if (expense.isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={80} radius={theme.radius.lg} />
        <Skeleton height={120} radius={theme.radius.lg} />
      </Screen>
    );
  }

  const data = expense.data;
  if (!data) {
    return (
      <Screen center>
        {header}
        <Text variant="headline" color="negative" testID="expense-detail-missing">
          {t('notFound')}
        </Text>
      </Screen>
    );
  }

  const amount = Number(data.amount);
  const rate = Number(data.exchange_rate);
  const crossCurrency = data.currency !== baseCurrency && rate > 0;

  const row = (label: string, value: string, testID: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" testID={testID}>
        {value}
      </Text>
    </View>
  );

  return (
    <Screen>
      {header}

      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="amountXL" testID="expense-detail-amount">
          {formatMoney(amount, data.currency)}
        </Text>
        {crossCurrency ? (
          <Text variant="footnote" color="textSecondary" testID="expense-detail-converted">
            🔒 {t('convertedTotal', { amount: formatMoney(amount * rate, baseCurrency) })} ·{' '}
            {t('lockedRate', {
              from: data.currency,
              rate: rate.toFixed(4),
              to: baseCurrency,
            })}
          </Text>
        ) : null}
        <Text variant="title2" testID="expense-detail-description">
          {data.description || t('title')}
        </Text>
      </View>

      <Surface style={{ gap: theme.spacing.md }}>
        {row(t('paidBy'), nameOf(data.payer_id) || (data.payer?.display_name ?? ''), 'expense-detail-payer')}
        {row(t('date'), formatFullDate(data.date), 'expense-detail-date')}
      </Surface>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="footnote" color="textSecondary">
          {t('participants').toUpperCase()}
        </Text>
        <Surface style={{ gap: theme.spacing.md }}>
          {data.splits.map((split) => (
            <View
              key={split.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
            >
              <Avatar uri={avatarOf(split.user_id)} name={nameOf(split.user_id)} size={28} />
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {nameOf(split.user_id)}
              </Text>
              <Text variant="amountM" testID={`expense-detail-split-${split.user_id}`}>
                {formatMoney(Number(split.owed_amount), data.currency)}
              </Text>
            </View>
          ))}
        </Surface>
      </View>

      <Text variant="footnote" color="textSecondary" testID="expense-detail-meta">
        {t('addedBy', {
          name: nameOf(data.created_by ?? '') || (data.payer?.display_name ?? ''),
          date: `${formatFullDate(data.date)} ${formatTimeOfDay(data.date)}`,
        })}
      </Text>
    </Screen>
  );
}

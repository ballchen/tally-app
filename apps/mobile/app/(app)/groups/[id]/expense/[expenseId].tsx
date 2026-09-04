import { useGroupDetails } from '@tally/shared/queries/group-details';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatFullDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

/** Placeholder until Phase 5 builds the full expense detail screen. */
export default function ExpenseDetailScreen() {
  const theme = useTheme();
  const t = useT('GroupDetails');
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const details = useGroupDetails(id);

  const expense = details.data?.expenses.find((e) => e.id === expenseId);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('expense') }} />
      {!expense ? (
        <Skeleton height={80} radius={theme.radius.lg} />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="amountXL" testID="expense-detail-amount">
            {formatMoney(Number(expense.amount), expense.currency)}
          </Text>
          <Text variant="title2" testID="expense-detail-description">
            {expense.description || t('expense')}
          </Text>
          <Text variant="subhead" color="textSecondary">
            {t('paidBy', { name: expense.payer?.display_name ?? '' })} · {formatFullDate(expense.date)}
          </Text>
        </View>
      )}
    </Screen>
  );
}

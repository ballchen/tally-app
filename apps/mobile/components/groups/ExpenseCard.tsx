import type { GroupExpense } from '@tally/shared/queries/group-details';
import { Pressable, View } from 'react-native';

import { AvatarStack } from '@/components/ui/AvatarStack';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { formatMonthShort, formatDayOfMonth } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/useTheme';

export type ExpenseCardProps = {
  expense: GroupExpense;
  fallbackTitle: string;
  paidByLabel: string;
  /** Marks a standalone repayment card (e.g. one whose settlement was undone). */
  badgeLabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
  /** Only the glyph-free long press reveals edit/delete, so VoiceOver is told. */
  longPressHint?: string;
};

export function ExpenseCard({
  expense,
  fallbackTitle,
  paidByLabel,
  badgeLabel,
  onPress,
  onLongPress,
  longPressHint,
}: ExpenseCardProps) {
  const theme = useTheme();
  const splits = expense.expense_splits ?? [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={onLongPress ? longPressHint : undefined}
      testID={`expense-card-${expense.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <Surface
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
        }}
      >
        <View style={{ width: 44, alignItems: 'center' }}>
          <Text variant="caption" color="textSecondary">
            {formatMonthShort(expense.date)}
          </Text>
          <Text variant="title2">{formatDayOfMonth(expense.date)}</Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {expense.description || fallbackTitle}
          </Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {badgeLabel ? `${badgeLabel} · ` : ''}
            {paidByLabel}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: theme.spacing.xs }}>
          <Text variant="amountM" testID={`expense-amount-${expense.id}`}>
            {formatMoney(Number(expense.amount), expense.currency)}
          </Text>
          <AvatarStack
            size={20}
            max={4}
            members={splits.map((split) => ({
              id: split.user_id,
              name: split.profiles?.display_name ?? null,
              avatarUrl: split.profiles?.avatar_url ?? null,
            }))}
          />
        </View>
      </Surface>
    </Pressable>
  );
}

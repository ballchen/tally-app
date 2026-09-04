import { Pressable, View } from 'react-native';

import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { formatFullDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { TimelineItem } from '@/lib/timeline';
import { useTheme } from '@/theme/useTheme';

export type SettlementCardProps = {
  item: Extract<TimelineItem, { kind: 'settlement' }>;
  baseCurrency: string;
  settledByLabel: string;
  totalLabel: string;
  unknownName: string;
  expanded: boolean;
  onToggle: () => void;
  /** Null while the group is archived, which forbids undoing a settlement. */
  undoLabel: string | null;
  onUndo: () => void;
};

export function SettlementCard({
  item,
  baseCurrency,
  settledByLabel,
  totalLabel,
  unknownName,
  expanded,
  onToggle,
  undoLabel,
  onUndo,
}: SettlementCardProps) {
  const theme = useTheme();
  const { settlement, repayments, total } = item;

  return (
    <Surface
      testID={`settlement-card-${settlement.id}`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.settlement,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        testID={`settlement-toggle-${settlement.id}`}
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" color="settlement" numberOfLines={1}>
            {settledByLabel} {settlement.creator?.display_name ?? unknownName}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {formatFullDate(settlement.created_at)}
            {total > 0 ? ` · ${formatMoney(total, baseCurrency)} ${totalLabel}` : ''}
          </Text>
        </View>
        <Text variant="footnote" color="textSecondary">
          {expanded ? '▴' : '▾'}
        </Text>
      </Pressable>

      {expanded ? (
        <View
          style={{
            gap: theme.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingTop: theme.spacing.sm,
          }}
        >
          {repayments.map((repayment) => (
            <View
              key={repayment.id}
              testID={`repayment-${repayment.id}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
            >
              <Text variant="subhead" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
                {repayment.payer?.display_name ?? unknownName} →{' '}
                {repayment.expense_splits?.[0]?.profiles?.display_name ?? unknownName}
              </Text>
              <Text variant="amountM">
                {formatMoney(Number(repayment.amount), repayment.currency)}
              </Text>
            </View>
          ))}

          {undoLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={undoLabel}
              testID={`undo-settlement-${settlement.id}`}
              onPress={onUndo}
              style={{ alignItems: 'center', paddingTop: theme.spacing.xs }}
            >
              <Text variant="subhead" color="negative">
                {undoLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

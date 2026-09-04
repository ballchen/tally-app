import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

export type DebtParty = { id: string; name: string; avatarUrl: string | null };

export type DebtRowProps = {
  from: DebtParty;
  to: DebtParty;
  amount: string;
  owesLabel: string;
  /** Only a party to the debt may record its payment. */
  settleLabel: string | null;
  settling?: boolean;
  onSettle: () => void;
};

export function DebtRow({
  from,
  to,
  amount,
  owesLabel,
  settleLabel,
  settling = false,
  onSettle,
}: DebtRowProps) {
  const theme = useTheme();

  return (
    <View
      testID={`debt-${from.id}-${to.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar uri={from.avatarUrl} name={from.name} size={28} />
        <Text variant="footnote" color="textSecondary" style={{ marginHorizontal: 2 }}>
          →
        </Text>
        <Avatar uri={to.avatarUrl} name={to.name} size={28} />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {from.name}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {owesLabel} {to.name}
        </Text>
      </View>

      <Text variant="amountM" testID={`debt-amount-${from.id}-${to.id}`}>
        {amount}
      </Text>

      {settleLabel ? (
        <Button
          testID={`settle-${from.id}-${to.id}`}
          variant="secondary"
          title={settleLabel}
          loading={settling}
          onPress={onSettle}
        />
      ) : null}
    </View>
  );
}

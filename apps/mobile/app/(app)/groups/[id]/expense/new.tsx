import { Stack } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';

/** Placeholder until Phase 5 builds the add-expense flow. */
export default function NewExpenseScreen() {
  const t = useT('AddExpense');

  return (
    <Screen center>
      <Stack.Screen options={{ title: t('enterAmount') }} />
      <Text variant="title2" testID="new-expense-placeholder" style={{ textAlign: 'center' }}>
        {t('enterAmount')}
      </Text>
    </Screen>
  );
}

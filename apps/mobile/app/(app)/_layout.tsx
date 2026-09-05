import { Stack } from 'expo-router';

import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const theme = useTheme();
  const tGroups = useT('Groups');

  // A form sheet's content container collapses to zero height unless told to fill the sheet.
  const sheetOptions = {
    presentation: 'formSheet',
    headerShown: false,
    contentStyle: { flex: 1, backgroundColor: theme.colors.background },
  } as const;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { color: theme.colors.text },
        headerLargeTitleStyle: { color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Tally', headerLargeTitle: true }} />
      <Stack.Screen name="profile" options={{ title: tGroups('openProfile') }} />
      <Stack.Screen name="groups/new" options={sheetOptions} />
      <Stack.Screen name="groups/[id]/index" options={{ title: '' }} />
      <Stack.Screen
        name="groups/[id]/settings"
        options={{ ...sheetOptions, sheetAllowedDetents: [0.95] }}
      />
      <Stack.Screen
        name="groups/[id]/activity"
        options={{ ...sheetOptions, sheetAllowedDetents: [0.5, 0.92] }}
      />
      <Stack.Screen
        name="groups/[id]/settle"
        options={{ ...sheetOptions, sheetAllowedDetents: [0.6, 0.92] }}
      />
      <Stack.Screen name="groups/[id]/expense/new" options={{ presentation: 'modal', title: '' }} />
      <Stack.Screen
        name="groups/[id]/expense/[expenseId]/edit"
        options={{ presentation: 'modal', title: '' }}
      />
      <Stack.Screen name="groups/[id]/expense/[expenseId]/index" options={{ title: '' }} />
    </Stack>
  );
}

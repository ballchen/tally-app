import { Stack } from 'expo-router';

import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const theme = useTheme();
  const tProfile = useT('Profile');

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
      {/* The list carries no title of its own, but the screens it pushes label
          their back button with it, so the title stays and only its rendering
          is dropped. */}
      <Stack.Screen
        name="index"
        options={{ title: 'Tally', headerLargeTitle: false, headerTitle: '' }}
      />
      {/* iOS labels a back button with the previous screen's title, which the
          untitled list no longer supplies. */}
      <Stack.Screen
        name="profile"
        options={{ title: tProfile('title'), headerBackTitle: 'Tally' }}
      />
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

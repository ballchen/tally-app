import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

export default function GroupsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Auth');
  const email = useAuthStore((s) => s.session?.user.email);

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="largeTitle">Groups</Text>
        <Text variant="subhead" color="textSecondary">
          Phase 3 — signed in as {email ?? 'unknown'}
        </Text>
      </View>
      <Button title={t('signOut')} variant="destructive" onPress={() => supabase.auth.signOut()} />
      {__DEV__ ? (
        <Button
          title="Component gallery"
          variant="ghost"
          onPress={() => router.push('/components')}
        />
      ) : null}
    </Screen>
  );
}

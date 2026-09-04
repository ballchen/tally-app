import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

/** Placeholder until Phase 6 builds the real profile screen. */
export default function ProfileScreen() {
  const router = useRouter();
  const t = useT('Auth');

  return (
    <Screen>
      <Text variant="title2">Profile</Text>
      <Button
        title={t('signOut')}
        variant="destructive"
        onPress={() => supabase.auth.signOut()}
      />
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

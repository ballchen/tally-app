import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { establishSessionFromUrl } from '@/lib/auth-link';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Auth');
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const initialUrl = url ?? (await Linking.getInitialURL());
      const result = initialUrl ? await establishSessionFromUrl(initialUrl) : null;
      if (cancelled) return;

      if (result?.ok) {
        router.replace('/');
        return;
      }
      setError(result?.ok === false ? result.error : t('loginFailed'));
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [url, router, t]);

  if (!error) {
    return (
      <Screen center scroll={false}>
        <ActivityIndicator color={theme.colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen center>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{t('loginFailed')}</Text>
        <Text variant="subhead" color="negative">
          {error}
        </Text>
      </View>
      <Button title={t('signIn')} onPress={() => router.replace('/login')} />
    </Screen>
  );
}

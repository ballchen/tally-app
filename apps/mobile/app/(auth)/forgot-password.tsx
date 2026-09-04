import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/useTheme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('ForgotPassword');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendLink() {
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'tally://reset-password',
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <Screen center>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{sent ? t('checkEmailTitle') : t('title')}</Text>
        <Text variant="subhead" color="textSecondary">
          {sent ? t('sentDescription') : t('description')}
        </Text>
      </View>

      {sent ? (
        <Button variant="secondary" title={t('sendAnother')} onPress={() => setSent(false)} />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Input
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            error={error}
          />
          <Button title={t('sendLink')} size="lg" loading={loading} onPress={sendLink} />
        </View>
      )}

      <Button variant="ghost" title={t('backToLogin')} onPress={() => router.replace('/login')} />
    </Screen>
  );
}

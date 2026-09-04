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

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function signUp() {
    setError(null);
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The profiles trigger reads full_name from user metadata.
        data: { full_name: name },
        emailRedirectTo: 'tally://auth/callback',
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Screen center>
        <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          <Text variant="title1">{t('accountCreated')}</Text>
          <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('checkEmail')}
          </Text>
        </View>
        <Button variant="secondary" title={t('signIn')} onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen center>
      <Text variant="title1">{t('signUp')}</Text>
      <View style={{ gap: theme.spacing.md }}>
        <Input
          label={t('displayName')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
        />
        <Input
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Input
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          error={error}
        />
        <Button title={t('createAccount')} size="lg" loading={loading} onPress={signUp} />
        <Button variant="ghost" title={t('signIn')} onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

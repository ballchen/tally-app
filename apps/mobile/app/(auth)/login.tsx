import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppleSignInButton } from '@/components/AppleSignInButton';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/useTheme';

const REMEMBERED_EMAIL_KEY = 'tally.remembered_email';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY).then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
  }

  return (
    <Screen center>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 72, height: 72, borderRadius: theme.radius.lg }}
        />
        <Text variant="title1">{t('welcomeTitle')}</Text>
        <Text variant="subhead" color="textSecondary">
          {t('welcomeDescription')}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Input
          testID="login-email"
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Input
          testID="login-password"
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          error={error}
        />
        <Button testID="login-submit" title={t('signIn')} size="lg" loading={loading} onPress={signIn} />
        <Button
          variant="ghost"
          title={t('forgotPassword')}
          onPress={() => router.push('/forgot-password')}
        />
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <AppleSignInButton onError={setError} />
        <Button
          variant="secondary"
          title={t('createAccount')}
          onPress={() => router.push('/register')}
        />
      </View>
    </Screen>
  );
}

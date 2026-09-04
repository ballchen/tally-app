import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { establishSessionFromUrl } from '@/lib/auth-link';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/useTheme';

type LinkState = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('ResetPassword');
  const url = Linking.useURL();

  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const initialUrl = url ?? (await Linking.getInitialURL());
      if (!initialUrl) {
        // Reached without a link (e.g. an already-authenticated user tapping through).
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setLinkState(data.session ? 'ready' : 'invalid');
        return;
      }

      const result = await establishSessionFromUrl(initialUrl);
      if (cancelled) return;

      if (!result) {
        setLinkError(t('sessionErrorInvalid'));
        setLinkState('invalid');
        return;
      }
      if (!result.ok) {
        setLinkError(t('sessionErrorExpired'));
        setLinkState('invalid');
        return;
      }
      setLinkState('ready');
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [url, t]);

  async function submit() {
    if (password.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordsDontMatch'));
      return;
    }

    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    showToast({ type: 'success', title: t('successToastTitle') });
    router.replace('/');
  }

  if (linkState === 'checking') {
    return (
      <Screen center scroll={false}>
        <ActivityIndicator color={theme.colors.primary} />
      </Screen>
    );
  }

  if (linkState === 'invalid') {
    return (
      <Screen center>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">{t('title')}</Text>
          <Text variant="subhead" color="negative">
            {linkError ?? t('sessionErrorInvalid')}
          </Text>
        </View>
        <Button
          variant="secondary"
          title={t('requestNewLink')}
          onPress={() => router.replace('/forgot-password')}
        />
        <Button title={t('backToLogin')} variant="ghost" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen center>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{t('title')}</Text>
        <Text variant="subhead" color="textSecondary">
          {t('description')}
        </Text>
      </View>
      <View style={{ gap: theme.spacing.md }}>
        <Input
          label={t('newPassword')}
          placeholder={t('newPasswordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />
        <Input
          label={t('confirmPassword')}
          placeholder={t('confirmPasswordPlaceholder')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          textContentType="newPassword"
          error={error}
        />
        <Button title={t('submitButton')} size="lg" loading={loading} onPress={submit} />
      </View>
    </Screen>
  );
}

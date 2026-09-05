import { AVAILABLE_CURRENCIES, getCurrencySymbol } from '@tally/shared/currency';
import { useProfile, useUploadAvatarBinary } from '@tally/shared/queries/profile';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  AppState,
  Linking,
  Pressable,
  View,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import {
  LOCALE_PREFERENCES,
  useLocaleStore,
  useT,
  type LocalePreference,
} from '@/lib/i18n';
import { setForcedOffline, useIsOnline } from '@/lib/online';
import {
  getPushStatus,
  promptForPush,
  registerForPush,
  unregisterPush,
  type PushStatus,
} from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

const AVATAR_WIDTH = 512;
const AVATAR_QUALITY = 0.8;

const LANGUAGE_LABELS: Record<LocalePreference, string> = {
  system: '',
  en: 'English',
  'zh-TW': '繁體中文',
  ja: '日本語',
};

/** `unconfigured` is granted-but-tokenless: no EAS projectId in this build. */
type PushState = PushStatus | 'unconfigured';

const PUSH_STATUS_KEY: Record<PushState, string> = {
  granted: 'statusGranted',
  denied: 'statusDenied',
  undetermined: 'statusUndetermined',
  unconfigured: 'statusUnconfigured',
};

const PUSH_HINT_KEY: Partial<Record<PushState, string>> = {
  denied: 'deniedHint',
  unconfigured: 'unconfiguredHint',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="footnote" color="textSecondary">
        {title.toUpperCase()}
      </Text>
      <Surface style={{ gap: theme.spacing.lg }}>{children}</Surface>
    </View>
  );
}

function DisclosureRow({
  label,
  value,
  testID,
  onPress,
}: {
  label: string;
  value: string;
  testID: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      testID={testID}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Text variant="body">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="body" color="textSecondary">
          {value}
        </Text>
        <Text variant="body" color="textSecondary">
          ›
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('Profile');
  const tPush = useT('Push');
  const online = useIsOnline();
  const email = useAuthStore((s) => s.session?.user.email);

  const { data: profile, updateProfile } = useProfile();
  const uploadAvatar = useUploadAvatarBinary();

  const preference = useLocaleStore((s) => s.preference);
  const setPreference = useLocaleStore((s) => s.setPreference);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>('undetermined');
  const [deleting, setDeleting] = useState(false);

  const name = nameDraft ?? profile?.display_name ?? '';
  const currency = profile?.default_currency ?? 'TWD';
  const languageLabel = preference === 'system' ? t('languageSystem') : LANGUAGE_LABELS[preference];

  const refreshPushStatus = useCallback(async () => {
    const status = await getPushStatus();
    if (status !== 'granted') {
      setPushState(status);
      return;
    }
    setPushState((await registerForPush()) === 'unconfigured' ? 'unconfigured' : 'granted');
  }, []);

  // The status can change while the app is backgrounded in iOS Settings.
  useFocusEffect(
    useCallback(() => {
      refreshPushStatus();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refreshPushStatus();
      });
      return () => subscription.remove();
    }, [refreshPushStatus]),
  );

  const save = async (updates: Parameters<typeof updateProfile.mutateAsync>[0], successKey: string) => {
    try {
      await updateProfile.mutateAsync(updates);
      showToast({ type: 'success', title: t(successKey) });
    } catch (error) {
      showToast({ type: 'error', title: t('saveFailed'), message: errorMessage(error) });
    }
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile?.display_name) return;
    save({ display_name: trimmed }, 'nameSaved');
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ type: 'error', title: t('photoPermission') });
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (picked.canceled) return;

    try {
      const resized = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: AVATAR_WIDTH } }],
        { compress: AVATAR_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
      );
      const body = await fetch(resized.uri).then((response) => response.arrayBuffer());
      const url = await uploadAvatar.mutateAsync({
        body,
        extension: 'jpg',
        contentType: 'image/jpeg',
      });
      await save({ avatar_url: url }, 'avatarSaved');
    } catch (error) {
      showToast({ type: 'error', title: t('avatarFailed'), message: errorMessage(error) });
    }
  };

  const openCurrencyPicker = () => {
    const options = [...AVAILABLE_CURRENCIES];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('defaultCurrency'),
        options: [...options, t('cancel')],
        cancelButtonIndex: options.length,
        userInterfaceStyle: theme.scheme,
      },
      (index) => {
        if (index < options.length) save({ default_currency: options[index] }, 'currencySaved');
      },
    );
  };

  const openLanguagePicker = () => {
    const labels = LOCALE_PREFERENCES.map((p) =>
      p === 'system' ? t('languageSystem') : LANGUAGE_LABELS[p],
    );
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('language'),
        options: [...labels, t('cancel')],
        cancelButtonIndex: labels.length,
        userInterfaceStyle: theme.scheme,
      },
      (index) => {
        if (index < labels.length) setPreference(LOCALE_PREFERENCES[index]);
      },
    );
  };

  const handlePushAction = async () => {
    if (pushState === 'undetermined') {
      await promptForPush();
      refreshPushStatus();
      return;
    }
    Linking.openSettings();
  };

  const signOut = async () => {
    await unregisterPush();
    await supabase.auth.signOut();
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await unregisterPush();
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (error) {
      showToast({ type: 'error', title: t('deleteFailed'), message: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('deleteTitle'), t('deleteMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteContinue'),
        style: 'destructive',
        onPress: () =>
          Alert.prompt(
            t('deleteConfirmTitle'),
            t('deleteConfirmMessage'),
            [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('deleteForever'),
                style: 'destructive',
                onPress: (typed?: string) => {
                  const answer = (typed ?? '').trim();
                  if (answer === t('deleteConfirmWord') || answer === email) runDelete();
                },
              },
            ],
            'plain-text',
          ),
      },
    ]);
  };

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('changePhoto')}
          testID="profile-avatar"
          onPress={pickAvatar}
        >
          <Avatar uri={profile?.avatar_url} name={profile?.display_name} size={64} />
        </Pressable>
        <Button
          testID="profile-change-photo"
          variant="ghost"
          title={t('changePhoto')}
          loading={uploadAvatar.isPending}
          onPress={pickAvatar}
        />
      </View>

      <Section title={t('account')}>
        <Input
          testID="profile-name"
          label={t('displayName')}
          value={name}
          onChangeText={setNameDraft}
          onBlur={saveName}
          onSubmitEditing={saveName}
          returnKeyType="done"
          placeholder={t('namePlaceholder')}
        />
        {email ? (
          <Text variant="footnote" color="textSecondary">
            {email}
          </Text>
        ) : null}
        <Button
          testID="profile-save-name"
          title={t('save')}
          loading={updateProfile.isPending}
          onPress={saveName}
        />
      </Section>

      <Section title={t('preferences')}>
        <DisclosureRow
          testID="profile-currency"
          label={t('defaultCurrency')}
          value={`${currency} ${getCurrencySymbol(currency)}`}
          onPress={openCurrencyPicker}
        />
        <DisclosureRow
          testID="profile-language"
          label={t('language')}
          value={languageLabel}
          onPress={openLanguagePicker}
        />
      </Section>

      <Section title={tPush('title')}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="body" testID="profile-push-status">
            {tPush(PUSH_STATUS_KEY[pushState])}
          </Text>
          {PUSH_HINT_KEY[pushState] ? (
            <Text variant="footnote" color="textSecondary">
              {tPush(PUSH_HINT_KEY[pushState])}
            </Text>
          ) : null}
        </View>
        {pushState === 'granted' || pushState === 'unconfigured' ? null : (
          <Button
            testID="profile-push-action"
            variant="secondary"
            title={pushState === 'undetermined' ? tPush('turnOn') : tPush('openSettings')}
            onPress={handlePushAction}
          />
        )}
      </Section>

      <Section title={t('dangerZone')}>
        <Button testID="profile-signout" variant="secondary" title={t('signOut')} onPress={signOut} />
        <Button
          testID="profile-delete"
          variant="destructive"
          title={t('deleteAccount')}
          loading={deleting}
          onPress={confirmDelete}
        />
      </Section>

      {__DEV__ ? (
        <>
          <Button
            title="Component gallery"
            variant="ghost"
            onPress={() => router.push('/components')}
          />
          {/* A Simulator cannot be taken off the network from the host, so the
              offline path is exercised through this override. */}
          <Button
            testID="profile-simulate-offline"
            title={online ? 'Simulate offline' : 'Go back online'}
            variant="ghost"
            onPress={() => setForcedOffline(online)}
          />
        </>
      ) : null}
    </Screen>
  );
}

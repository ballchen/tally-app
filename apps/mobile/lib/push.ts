import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type PushStatus = 'granted' | 'denied' | 'undetermined';

/**
 * `unconfigured` means the device could report a token but the app has no EAS
 * projectId yet, so Expo cannot mint one. Kept distinct from `denied` so the UI
 * can say "not set up" instead of blaming the user's permission choice.
 */
export type PushRegistration = 'registered' | 'needsPrompt' | 'denied' | 'unconfigured';

const TOKEN_KEY_PREFIX = 'push-expo-token';
const PROMPT_DISMISSED_KEY_PREFIX = 'push-prompt-dismissed';

// Unscoped keys would leak a previous account's dismissal/token state to
// whoever signs in next on the same device.
function tokenKey(userId: string): string {
  return `${TOKEN_KEY_PREFIX}:${userId}`;
}

function promptDismissedKey(userId: string): string {
  return `${PROMPT_DISMISSED_KEY_PREFIX}:${userId}`;
}

export function setupPushHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getPushStatus(): Promise<PushStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

async function resolveExpoToken(): Promise<string | null> {
  // A Simulator has no APNs registration, so `getExpoPushTokenAsync` always throws
  // there. Debug builds substitute a stable fake token so the device_tokens write,
  // sign-out cleanup and settings UI can still be exercised end to end.
  if (!Device.isDevice) {
    if (!__DEV__) return null;
    const id = `${Device.modelId ?? 'sim'}-${Device.deviceName ?? ''}`.replace(/[^a-zA-Z0-9]+/g, '');
    return `ExponentPushToken[sim-${id}]`;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

async function storeToken(token: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  await supabase
    .from('device_tokens')
    .upsert(
      { user_id: data.user.id, expo_token: token, platform: 'ios' },
      { onConflict: 'expo_token' },
    );
  await AsyncStorage.setItem(tokenKey(data.user.id), token);
}

/** Registers the device without ever showing the system prompt. */
export async function registerForPush(): Promise<PushRegistration> {
  const status = await getPushStatus();
  if (status === 'undetermined') return 'needsPrompt';
  if (status === 'denied') return 'denied';

  const token = await resolveExpoToken();
  if (!token) return 'unconfigured';

  await storeToken(token);
  return 'registered';
}

/** Shows the system prompt, then registers if the user allowed it. */
export async function promptForPush(): Promise<PushRegistration> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  return registerForPush();
}

/** Must run before sign-out, while the session can still satisfy the RLS policy. */
export async function unregisterPush(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const key = tokenKey(data.user.id);
  const token = await AsyncStorage.getItem(key);
  if (!token) return;

  await supabase.from('device_tokens').delete().eq('expo_token', token);
  await AsyncStorage.removeItem(key);
}

/** The path push-send puts in `data.url`, e.g. `/groups/<id>`. */
export function pushRoute(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') && url !== '/' ? url : null;
}

export type PushPrompt = {
  visible: boolean;
  enable: () => Promise<void>;
  dismiss: () => Promise<void>;
};

/**
 * Drives the pre-permission explainer card: shown once per account, before
 * the system prompt. `userId` is undefined until the session resolves, which
 * `enabled` already gates.
 */
export function usePushPrompt(enabled: boolean, userId?: string | null): PushPrompt {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    (async () => {
      const [status, dismissed] = await Promise.all([
        getPushStatus(),
        AsyncStorage.getItem(promptDismissedKey(userId)),
      ]);
      if (active) setVisible(status === 'undetermined' && !dismissed);
    })();
    return () => {
      active = false;
    };
  }, [enabled, userId]);

  const enable = useCallback(async () => {
    setVisible(false);
    if (userId) await AsyncStorage.setItem(promptDismissedKey(userId), '1');
    await promptForPush();
  }, [userId]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    if (userId) await AsyncStorage.setItem(promptDismissedKey(userId), '1');
  }, [userId]);

  return { visible, enable, dismiss };
}

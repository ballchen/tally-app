import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { pushRoute, registerForPush } from '@/lib/push';
import { useAuthStore } from '@/stores/auth';

/**
 * Keeps the device token in sync with the signed-in user and routes notification
 * taps. A tap arriving while signed out is parked as the pending route so AuthGate
 * replays it after login, the same way an invite deep link is handled.
 */
export function PushLinking() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const setPendingRoute = useAuthStore((s) => s.setPendingRoute);

  const userId = session?.user.id;
  useEffect(() => {
    if (userId) registerForPush();
  }, [userId]);

  useEffect(() => {
    const go = (route: string | null) => {
      if (!route) return;
      if (useAuthStore.getState().session) router.push(route as Href);
      else setPendingRoute(route);
    };

    // A tap that launched the app from a cold start is already waiting here.
    Notifications.getLastNotificationResponseAsync().then((response) => go(pushRoute(response)));

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      go(pushRoute(response)),
    );
    return () => subscription.remove();
  }, [router, setPendingRoute]);

  return null;
}

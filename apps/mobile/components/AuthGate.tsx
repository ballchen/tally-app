import {
  useRootNavigationState,
  useRouter,
  useSegments,
  usePathname,
  type Href,
} from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/stores/auth';

/** Routes reachable while signed out; everything else bounces to /login and is replayed after sign-in. */
const PUBLIC_PREFIXES = ['/reset-password', '/auth/callback'];

function isPublic(segments: string[], pathname: string) {
  if (segments[0] === '(auth)') return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  // Until the root navigator has resolved its initial (possibly deep-linked) route,
  // `pathname` still reads "/" and we would bounce away from the incoming link.
  const navigationKey = useRootNavigationState()?.key;
  const { session, initialized, pendingRoute, setPendingRoute } = useAuthStore();

  useEffect(() => {
    if (!initialized || !navigationKey) return;

    if (!session) {
      if (isPublic(segments as string[], pathname)) return;
      if (pathname !== '/') setPendingRoute(pathname);
      router.replace('/login');
      return;
    }

    // Kept set until we actually land on it, otherwise the "(auth) → home" rule below
    // fires on the render before `pathname` catches up and cancels the replay.
    if (pendingRoute) {
      if (pathname === pendingRoute) setPendingRoute(null);
      else router.replace(pendingRoute as Href);
      return;
    }

    if (segments[0] === '(auth)') router.replace('/');
  }, [initialized, navigationKey, session, pendingRoute, pathname, segments, router, setPendingRoute]);

  return null;
}

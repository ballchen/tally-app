import { SupabaseProvider } from '@tally/shared/supabase-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/AuthGate';
import { PushLinking } from '@/components/PushLinking';
import { AppToast } from '@/components/ui/Toast';
import { hydrateLocalePreference, useLocaleStore } from '@/lib/i18n';
import { setupPushHandler } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();
setupPushHandler();

function createQueryClient() {
  return new QueryClient({
    // Cached data stays readable while offline instead of the query hanging.
    defaultOptions: { queries: { networkMode: 'offlineFirst' }, mutations: { networkMode: 'offlineFirst' } },
  });
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const theme = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const initialized = useAuthStore((s) => s.initialized);
  const localeHydrated = useLocaleStore((s) => s.hydrated);

  useEffect(() => {
    hydrateLocalePreference();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    if (initialized && localeHydrated) SplashScreen.hideAsync();
  }, [initialized, localeHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SupabaseProvider client={supabase}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <AuthGate />
            <PushLinking />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="reset-password" />
              <Stack.Screen name="auth/callback" />
              <Stack.Screen name="join/[code]" />
            </Stack>
            <AppToast />
          </QueryClientProvider>
        </SupabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

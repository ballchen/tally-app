import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { supabase } from '@/lib/supabase';

function joinName(fullName: AppleAuthentication.AppleAuthenticationCredential['fullName']) {
  return [fullName?.givenName, fullName?.middleName, fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function AppleSignInButton({ onError }: { onError: (message: string) => void }) {
  const [available, setAvailable] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={12}
      style={{ height: 48 }}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!credential.identityToken) {
            onError('Apple did not return an identity token.');
            return;
          }

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });
          if (error) {
            onError(error.message);
            return;
          }

          // Apple returns fullName only on the very first authorization, so persist it now.
          const displayName = joinName(credential.fullName);
          if (displayName && data.user) {
            await supabase.from('profiles').update({ display_name: displayName }).eq('id', data.user.id);
          }
        } catch (e) {
          const err = e as { code?: string; message?: string };
          if (err.code === 'ERR_REQUEST_CANCELED') return;
          onError(err.message ?? 'Apple sign-in failed.');
        }
      }}
    />
  );
}

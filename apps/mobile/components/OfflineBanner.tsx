import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { startNetworkWatcher, useIsOnline } from '@/lib/online';
import { palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT('Common');
  const online = useIsOnline();

  useEffect(() => startNetworkWatcher(), []);

  if (online) return null;

  return (
    <View
      // Reads as an extension of the status bar, and must not eat taps meant
      // for the header underneath it.
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      testID="offline-banner"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingTop: insets.top,
        paddingBottom: theme.spacing.xs,
        paddingHorizontal: theme.screenPadding,
        alignItems: 'center',
        backgroundColor: theme.colors.warning,
      }}
    >
      {/* `warning` is a light amber in both schemes, so the label stays dark in both. */}
      <Text variant="footnote" style={{ color: palette.light.text }}>
        {t('offline')}
      </Text>
    </View>
  );
}

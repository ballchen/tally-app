import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function JoinGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('JoinGroup');
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <Screen center>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{t('title')}</Text>
        <Text variant="subhead" color="textSecondary">
          {t('invited')}
        </Text>
      </View>
      <Surface style={{ gap: theme.spacing.xs }}>
        <Text variant="footnote" color="textSecondary">
          Invite code
        </Text>
        <Text variant="title2" accessibilityLabel={`Invite code ${code}`}>
          {code}
        </Text>
        <Text variant="footnote" color="textSecondary">
          Joining is wired up in Phase 3.
        </Text>
      </Surface>
      <Button variant="secondary" title={t('goHome')} onPress={() => router.replace('/')} />
    </Screen>
  );
}

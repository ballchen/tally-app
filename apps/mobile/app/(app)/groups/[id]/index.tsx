import { useGroupDetails } from '@tally/shared/queries/group-details';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { HeaderButton } from '@/components/ui/HeaderButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

/** Placeholder until Phase 4 builds the real group detail screen. */
export default function GroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('EditGroup');
  const { id } = useLocalSearchParams<{ id: string }>();
  const details = useGroupDetails(id);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: details.data?.group.name ?? '',
          headerRight: () => (
            <HeaderButton
              testID="open-group-settings"
              title={t('title')}
              onPress={() => router.push(`/groups/${id}/settings`)}
            />
          ),
        }}
      />
      {details.isLoading ? (
        <Skeleton height={28} width="60%" />
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="title1" testID="group-name-heading">
            {details.data?.group.name}
          </Text>
          <Text variant="subhead" color="textSecondary">
            {details.data?.group.base_currency}
          </Text>
        </View>
      )}
    </Screen>
  );
}

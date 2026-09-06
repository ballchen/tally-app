import type { ActivityLog } from '@tally/shared/queries/activity-logs';
import { useActivityLogs } from '@tally/shared/queries/activity-logs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { SheetHeader } from '@/components/ui/SheetHeader';
import { Text } from '@/components/ui/Text';
import { activityDescription, activityDetails, activityDotColor } from '@/lib/activity-text';
import { formatDayLabel, formatTimeOfDay } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

type Row = { kind: 'day'; key: string; label: string } | { kind: 'log'; key: string; log: ActivityLog };

export default function ActivityLogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('ActivityLog');
  const tGroup = useT('GroupDetails');
  const { id } = useLocalSearchParams<{ id: string }>();

  // The sheet is its own route, so mounting it is what starts the query.
  const logs = useActivityLogs(id);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let currentLabel = '';

    for (const page of logs.data?.pages ?? []) {
      for (const log of page.data) {
        const label = formatDayLabel(log.created_at, t);
        if (label !== currentLabel) {
          currentLabel = label;
          result.push({ kind: 'day', key: `day-${label}`, label });
        }
        result.push({ kind: 'log', key: log.id, log });
      }
    }

    return result;
  }, [logs.data, t]);

  return (
    <>
      <SheetHeader title={t('title')} closeLabel={tGroup('cancel')} onClose={() => router.back()} />
      <FlatList
        testID="activity-log-list"
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{
          paddingHorizontal: theme.screenPadding,
          paddingVertical: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (logs.hasNextPage && !logs.isFetchingNextPage) logs.fetchNextPage();
        }}
        ListEmptyComponent={
          logs.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('noActivity')}
            </Text>
          )
        }
        ListFooterComponent={logs.isFetchingNextPage ? <ActivityIndicator /> : null}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <Text variant="footnote" color="textSecondary" testID={`activity-day-${item.label}`}>
                {item.label.toUpperCase()}
              </Text>
            );
          }

          const { log } = item;
          const details = activityDetails(log, t, formatMoney);

          return (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  backgroundColor: theme.colors[activityDotColor(log.action)],
                }}
              />
              <Avatar uri={log.profiles?.avatar_url} name={log.profiles?.display_name} size={20} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subhead">{activityDescription(log, t)}</Text>
                {details.map((line) => (
                  <Text key={line} variant="footnote" color="textSecondary">
                    {line}
                  </Text>
                ))}
                <Text variant="caption" color="textSecondary">
                  {formatTimeOfDay(log.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </>
  );
}

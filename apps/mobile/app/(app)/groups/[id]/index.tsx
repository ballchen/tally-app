import type { Debt } from '@tally/shared/balances';
import { useBalances } from '@tally/shared/queries/balances';
import { useDeleteExpense } from '@tally/shared/queries/expenses';
import type { GroupExpense } from '@tally/shared/queries/group-details';
import { useGroupDetails } from '@tally/shared/queries/group-details';
import type { RealtimeEvent } from '@tally/shared/queries/realtime';
import { useRealtimeSync } from '@tally/shared/queries/realtime';
import { useGranularSettle, useUndoSettlement } from '@tally/shared/queries/settlements';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  RefreshControl,
  Share,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { DebtRow } from '@/components/groups/DebtRow';
import { ExpenseCard } from '@/components/groups/ExpenseCard';
import { COVER_HEIGHT, GroupCover } from '@/components/groups/GroupCover';
import { MemberStrip, memberDisplayName } from '@/components/groups/MemberStrip';
import { SettlementCard } from '@/components/groups/SettlementCard';
import { Button } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { HeaderButton } from '@/components/ui/HeaderButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { monthKey, formatMonthTitle } from '@/lib/date';
import { buildTimeline, toMonthSections, type TimelineItem, type TimelineSection } from '@/lib/timeline';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

const INVITE_BASE_URL = 'https://tally.app/join';
const TIMELINE_PAGE_SIZE = 30;
const UNDO_WINDOW_MS = 5000;
const SETTLED_EPSILON = 0.01;
/** Roughly the cover height minus the navigation bar, where the title takes over. */
const COLLAPSE_OFFSET = COVER_HEIGHT - 96;

const REALTIME_MESSAGE: Record<RealtimeEvent['type'], string> = {
  'expense.added': 'expenseAdded',
  'expense.updated': 'expenseUpdated',
  'expense.deleted': 'expenseDeleted',
  'settlement.recorded': 'settlementRecorded',
  'settlement.undone': 'settlementUndone',
  'member.joined': 'memberJoined',
};

export default function GroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('GroupDetails');
  const tSettleUp = useT('SettleUp');
  const tActivity = useT('ActivityLog');
  const tRealtime = useT('Realtime');
  const tCommon = useT('Common');
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.session?.user.id) ?? '';

  const details = useGroupDetails(id);
  const granularSettle = useGranularSettle();
  const undoSettlement = useUndoSettlement();
  const deleteExpense = useDeleteExpense();

  const [collapsed, setCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const [expandedSettlements, setExpandedSettlements] = useState<ReadonlySet<string>>(new Set());
  const [scrollY] = useState(() => new Animated.Value(0));
  const [fabScale] = useState(() => new Animated.Value(1));

  const group = details.data?.group;
  const members = useMemo(() => details.data?.members ?? [], [details.data?.members]);
  const baseCurrency = group?.base_currency ?? 'TWD';
  const isArchived = Boolean(group?.archived_at);

  const { balances, debts, isLoading: balancesLoading } = useBalances(
    details.data?.expenses,
    members,
    baseCurrency,
  );

  const announce = useCallback(
    (event: RealtimeEvent) => {
      showToast({ type: 'info', title: tRealtime(REALTIME_MESSAGE[event.type]) });
    },
    [tRealtime],
  );

  // Channels are named after the group, so a second instance of this screen for
  // the same group would try to re-subscribe an already-subscribed channel.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useRealtimeSync(focused ? id : '', { currentUserId: userId, onEvent: announce });

  const nameOf = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.user_id === memberId);
      return member ? memberDisplayName(member) : '';
    },
    [members],
  );

  const partyOf = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.user_id === memberId);
      return {
        id: memberId,
        name: member ? memberDisplayName(member) : '',
        avatarUrl: member ? (member.group_avatar_url ?? member.profiles.avatar_url) : null,
      };
    },
    [members],
  );

  const timeline = useMemo(
    () => buildTimeline(details.data?.expenses, details.data?.settlements),
    [details.data?.expenses, details.data?.settlements],
  );
  const sections = useMemo(
    () => toMonthSections(timeline.slice(0, visibleCount), monthKey, formatMonthTitle),
    [timeline, visibleCount],
  );

  const runUndo = useCallback(
    async (settlementId: string) => {
      try {
        await undoSettlement.mutateAsync({ settlementId, groupId: id });
        showToast({ type: 'success', title: tSettleUp('settlementUndone') });
      } catch (error) {
        showToast({
          type: 'error',
          title: tSettleUp('undoFailed'),
          message: errorMessage(error),
        });
      }
    },
    [undoSettlement, id, tSettleUp],
  );

  const runSettle = useCallback(
    async (debt: Debt) => {
      try {
        const settlementId = await granularSettle.mutateAsync({
          groupId: id,
          debtorId: debt.from,
          creditorId: debt.to,
          amount: debt.amount,
          currency: baseCurrency,
          debtorName: nameOf(debt.from) || undefined,
          creditorName: nameOf(debt.to) || undefined,
        });

        showToast({
          type: 'success',
          title: tSettleUp('settlementRecorded'),
          durationMs: UNDO_WINDOW_MS,
          action:
            typeof settlementId === 'string'
              ? { label: t('undo'), onPress: () => runUndo(settlementId) }
              : undefined,
        });
      } catch (error) {
        showToast({
          type: 'error',
          title: tSettleUp('settlementFailed'),
          message: errorMessage(error),
        });
      }
    },
    [granularSettle, id, baseCurrency, nameOf, tSettleUp, t, runUndo],
  );

  const confirmSettle = useCallback(
    (debt: Debt) => {
      Alert.alert(
        t('confirmSettleTitle'),
        t('confirmSettleDesc', {
          from: nameOf(debt.from),
          to: nameOf(debt.to),
          amount: formatMoney(debt.amount, baseCurrency),
        }),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('confirmSettle'), onPress: () => runSettle(debt) },
        ],
      );
    },
    [t, nameOf, baseCurrency, runSettle],
  );

  const confirmUndo = useCallback(
    (settlementId: string) => {
      Alert.alert(t('undoSettlement'), t('undoSettlementDesc'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirmUndo'), style: 'destructive', onPress: () => runUndo(settlementId) },
      ]);
    },
    [t, runUndo],
  );

  const confirmDeleteExpense = useCallback(
    (expense: GroupExpense) => {
      const description = expense.description || t('expense');
      Alert.alert(t('deleteExpenseTitle'), t('deleteExpenseDesc', { description }), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense.mutateAsync({
                expenseId: expense.id,
                groupId: id,
                description: expense.description ?? undefined,
                amount: Number(expense.amount),
                currency: expense.currency,
              });
              showToast({ type: 'success', title: t('expenseDeleted') });
            } catch (error) {
              showToast({
                type: 'error',
                title: t('deleteExpenseFailed'),
                message: errorMessage(error),
              });
            }
          },
        },
      ]);
    },
    [t, deleteExpense, id],
  );

  const openExpenseMenu = useCallback(
    (expense: GroupExpense) => {
      if (isArchived) return;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('expenseOptions'),
          options: [t('edit'), t('delete'), t('cancel')],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) router.push(`/groups/${id}/expense/${expense.id}`);
          if (index === 1) confirmDeleteExpense(expense);
        },
      );
    },
    [isArchived, t, router, id, confirmDeleteExpense],
  );

  const toggleSettlement = useCallback((settlementId: string) => {
    setExpandedSettlements((previous) => {
      const next = new Set(previous);
      if (next.has(settlementId)) next.delete(settlementId);
      else next.add(settlementId);
      return next;
    });
  }, []);

  const shareInvite = useCallback(() => {
    if (!group) return;
    Share.share({ message: `${INVITE_BASE_URL}/${group.invite_code}` });
  }, [group]);

  const collapseFab = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0, useNativeDriver: true, speed: 40 }).start();
  }, [fabScale]);

  const expandFab = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  }, [fabScale]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setCollapsed(event.nativeEvent.contentOffset.y > COLLAPSE_OFFSET);
        },
      }),
    [scrollY],
  );

  const screenOptions = (
    <Stack.Screen
      options={{
        title: collapsed ? (group?.name ?? '') : '',
        headerTransparent: true,
        headerBlurEffect: collapsed ? 'systemChromeMaterial' : undefined,
        headerStyle: { backgroundColor: 'transparent' },
        headerLeft: () => (
          <HeaderButton
            testID="group-back"
            title="‹"
            accessibilityLabel={tCommon('back')}
            onPress={() => router.back()}
          />
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <HeaderButton
              testID="open-activity-log"
              title={tActivity('viewHistory')}
              onPress={() => router.push(`/groups/${id}/activity`)}
            />
            <HeaderButton
              testID="open-group-settings"
              title="•••"
              onPress={() => router.push(`/groups/${id}/settings`)}
            />
          </View>
        ),
      }}
    />
  );

  if (details.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {screenOptions}
        <Skeleton height={COVER_HEIGHT} radius={0} />
        <View style={{ padding: theme.screenPadding, gap: theme.spacing.lg }}>
          <Skeleton height={56} radius={theme.radius.lg} />
          <Skeleton height={120} radius={theme.radius.lg} />
          <Skeleton height={80} radius={theme.radius.lg} />
          <Skeleton height={80} radius={theme.radius.lg} />
        </View>
      </View>
    );
  }

  if (details.error || !group) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
          padding: theme.screenPadding,
        }}
      >
        {screenOptions}
        <Text variant="headline" color="negative" testID="group-error">
          {t('errorLoading')}
        </Text>
        <Button testID="retry-group" title={t('retry')} onPress={() => details.refetch()} />
      </View>
    );
  }

  const myBalance = balances[userId] ?? 0;
  const balanceLabel =
    Math.abs(myBalance) < SETTLED_EPSILON
      ? t('youAreSettled')
      : myBalance > 0
        ? t('youAreOwed', { amount: formatMoney(myBalance, baseCurrency) })
        : t('youOwe', { amount: formatMoney(-myBalance, baseCurrency) });
  const balanceColor =
    Math.abs(myBalance) < SETTLED_EPSILON ? 'textSecondary' : myBalance > 0 ? 'positive' : 'negative';

  const listHeader = (
    <View>
      <GroupCover
        name={group.name}
        coverUrl={group.cover_image_url}
        archivedLabel={isArchived ? t('archived') : null}
        scrollY={scrollY}
      />

      <View
        style={{
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.screenPadding,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.xl,
        }}
      >
        {isArchived ? (
          <Surface
            testID="archived-banner"
            style={{ backgroundColor: theme.colors.primarySoft, paddingVertical: theme.spacing.md }}
          >
            <Text variant="subhead" color="warning">
              {t('readOnlyBanner')}
            </Text>
          </Surface>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="footnote" color="textSecondary">
            {t('membersTitle').toUpperCase()}
          </Text>
          <MemberStrip members={members} inviteLabel={t('invite')} onInvite={shareInvite} />
        </View>

        <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
            {t('yourBalance')}
          </Text>
          <Text variant="amountL" color={balanceColor} testID="your-balance">
            {balanceLabel}
          </Text>
        </Surface>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="footnote" color="textSecondary">
            {t('outstandingBalances').toUpperCase()}
          </Text>
          <Surface style={{ gap: theme.spacing.lg }}>
            {balancesLoading ? (
              <>
                <Skeleton height={40} radius={theme.radius.md} />
                <Skeleton height={40} radius={theme.radius.md} />
              </>
            ) : debts.length === 0 ? (
              <Text variant="subhead" color="textSecondary" testID="all-settled">
                {t('allSettledUp')}
              </Text>
            ) : (
              <>
                {debts.map((debt) => (
                  <DebtRow
                    key={`${debt.from}-${debt.to}`}
                    from={partyOf(debt.from)}
                    to={partyOf(debt.to)}
                    amount={formatMoney(debt.amount, baseCurrency)}
                    owesLabel={t('owes')}
                    settleLabel={
                      !isArchived && (debt.from === userId || debt.to === userId)
                        ? t('settle')
                        : null
                    }
                    settling={
                      granularSettle.isPending &&
                      granularSettle.variables?.debtorId === debt.from &&
                      granularSettle.variables?.creditorId === debt.to
                    }
                    onSettle={() => confirmSettle(debt)}
                  />
                ))}
                {isArchived ? null : (
                  <Button
                    testID="settle-all"
                    variant="secondary"
                    title={tSettleUp('settleAll')}
                    onPress={() => router.push(`/groups/${id}/settle`)}
                  />
                )}
              </>
            )}
          </Surface>
        </View>

        <Text variant="footnote" color="textSecondary">
          {t('activity').toUpperCase()}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: TimelineItem }) => (
    <View style={{ paddingHorizontal: theme.screenPadding }}>
      {item.kind === 'expense' ? (
        <ExpenseCard
          expense={item.expense}
          fallbackTitle={t('expense')}
          paidByLabel={t('paidBy', { name: item.expense.payer?.display_name ?? '' })}
          onPress={() => router.push(`/groups/${id}/expense/${item.expense.id}`)}
          onLongPress={() => openExpenseMenu(item.expense)}
        />
      ) : item.kind === 'repayment' ? (
        <ExpenseCard
          expense={item.expense}
          fallbackTitle={t('repayment')}
          badgeLabel={t('repayment')}
          paidByLabel={t('paidBy', { name: item.expense.payer?.display_name ?? '' })}
          onPress={() => {}}
        />
      ) : (
        <SettlementCard
          item={item}
          baseCurrency={baseCurrency}
          settledByLabel={t('settledBy')}
          totalLabel={t('total')}
          unknownName={tSettleUp('someone')}
          expanded={expandedSettlements.has(item.settlement.id)}
          onToggle={() => toggleSettlement(item.settlement.id)}
          undoLabel={isArchived ? null : t('undoAction')}
          onUndo={() => confirmUndo(item.settlement.id)}
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {screenOptions}
      <Animated.SectionList<TimelineItem, TimelineSection>
        testID="group-timeline"
        sections={sections}
        keyExtractor={(item) => item.key}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        onScrollBeginDrag={collapseFab}
        // Not onScrollEndDrag: a released finger can still leave the list
        // coasting on momentum, and the FAB re-expanding mid-coast is the
        // exact "covers the card underneath" bug this collapse exists to fix.
        onMomentumScrollEnd={expandFab}
        scrollEventThrottle={16}
        stickySectionHeadersEnabled
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View
            style={{
              paddingHorizontal: theme.screenPadding,
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.xxl,
            }}
          >
            <Text variant="title2">{t('noExpensesYet')}</Text>
            <Text variant="subhead" color="textSecondary">
              {t('addExpenseToStart')}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        contentContainerStyle={{ paddingBottom: 140, backgroundColor: theme.colors.background }}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              backgroundColor: theme.colors.background,
              paddingHorizontal: theme.screenPadding,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
            }}
          >
            <Text variant="footnote" color="textSecondary" testID={`timeline-month-${section.key}`}>
              {section.title.toUpperCase()}
            </Text>
          </View>
        )}
        renderItem={renderItem}
        onEndReachedThreshold={0.4}
        onEndReached={() =>
          setVisibleCount((count) => Math.min(count + TIMELINE_PAGE_SIZE, timeline.length))
        }
        refreshControl={
          <RefreshControl refreshing={details.isRefetching} onRefresh={() => details.refetch()} />
        }
      />
      {isArchived ? null : (
        <Fab
          testID="add-expense-fab"
          accessibilityLabel={t('expense')}
          collapseScale={fabScale}
          onPress={() => router.push(`/groups/${id}/expense/new`)}
        />
      )}
    </View>
  );
}

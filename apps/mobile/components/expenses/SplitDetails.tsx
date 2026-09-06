import SegmentedControl from '@react-native-segmented-control/segmented-control';
import type { GroupMember } from '@tally/shared/members';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useId, useRef } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { memberDisplayName } from '@/components/groups/MemberStrip';
import { formatMoney, formatMoneyExact } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export type SplitMode = 'EQUAL' | 'EXACT' | 'PERCENT';

export type SplitDetailsProps = {
  amount: number;
  currency: string;
  members: GroupMember[];
  currentUserId: string;

  description: string;
  onDescriptionChange: (value: string) => void;

  date: Date;
  onDateChange: (value: Date) => void;

  payerId: string;
  onPayerChange: (userId: string) => void;

  splitMode: SplitMode;
  onSplitModeChange: (mode: SplitMode) => void;

  involvedIds: string[];
  onToggleInvolved: (userId: string) => void;
  /** Each member's share, already rounded to the currency's smallest unit. */
  splitAmounts: Record<string, number>;

  exactAmounts: Record<string, number>;
  onExactChange: (userId: string, value: string) => void;

  percentAmounts: Record<string, number>;
  onPercentChange: (userId: string, value: string) => void;

  remainingExact: number;
  remainingPercent: number;
  allocationValid: boolean;
};

const MODES: SplitMode[] = ['EQUAL', 'EXACT', 'PERCENT'];
/** Leaves the focused row clear of the section heading once scrolled to. */
const FOCUS_MARGIN = 24;

/** Keeps a leftover tenth of a percent visible instead of rounding it away to 100.0%. */
function formatPercent(value: number): string {
  return Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2);
}

export function SplitDetails({
  amount,
  currency,
  members,
  currentUserId,
  description,
  onDescriptionChange,
  date,
  onDateChange,
  payerId,
  onPayerChange,
  splitMode,
  onSplitModeChange,
  involvedIds,
  onToggleInvolved,
  splitAmounts,
  exactAmounts,
  onExactChange,
  percentAmounts,
  onPercentChange,
  remainingExact,
  remainingPercent,
  allocationValid,
}: SplitDetailsProps) {
  const theme = useTheme();
  const t = useT('SplitDetails');
  const tAdd = useT('AddExpense');
  const tCommon = useT('Common');
  // A decimal pad has no return key, so the allocation inputs share one Done bar.
  const accessoryId = useId();

  const nameOf = (member: GroupMember) =>
    member.user_id === currentUserId ? t('you') : memberDisplayName(member) || t('member');

  // The bar must agree with the save button, or an unsaveable form shows a
  // remainder of zero.
  const balanced = allocationValid;

  const remainingText =
    splitMode === 'EXACT'
      ? balanced
        ? t('perfectlyAllocated')
        : t('remaining', { value: formatMoneyExact(remainingExact, currency) })
      : balanced
        ? t('totalHundred')
        : t('remaining', { value: `${formatPercent(remainingPercent)}%` });

  const scrollRef = useRef<ScrollView>(null);
  const allocationsY = useRef(0);
  const rowY = useRef<Record<string, number>>({});

  // A focused allocation field otherwise stays behind the keyboard, and the
  // user types into a row they cannot see.
  const revealRow = (userId: string) => {
    const y = rowY.current[userId];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(allocationsY.current + y - FOCUS_MARGIN, 0) });
  };

  const numericInput = (
    member: GroupMember,
    value: number,
    onChange: (text: string) => void,
    suffix: string,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <TextInput
        testID={`split-input-${member.user_id}`}
        accessibilityLabel={`${nameOf(member)} ${suffix}`}
        keyboardType="decimal-pad"
        inputAccessoryViewID={accessoryId}
        placeholder="0"
        placeholderTextColor={theme.colors.textSecondary}
        value={value ? String(value) : ''}
        onChangeText={onChange}
        onFocus={() => revealRow(member.user_id)}
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        style={{
          minWidth: 80,
          height: 40,
          textAlign: 'right',
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontSize: theme.typography.body.fontSize,
        }}
      />
      <Text variant="footnote" color="textSecondary">
        {suffix}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="footnote" color="textSecondary">
            {t('totalBill').toUpperCase()}
          </Text>
          <Text variant="amountXL" color="primary" testID="split-total">
            {formatMoney(amount, currency)}
          </Text>
        </View>

        <Input
          testID="expense-description"
          autoFocus
          placeholder={t('descriptionPlaceholder')}
          value={description}
          onChangeText={onDescriptionChange}
          returnKeyType="done"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="subhead" color="textSecondary">
            {tAdd('dateLabel')}
          </Text>
          <View style={{ alignItems: 'flex-start' }}>
            <DateTimePicker
              testID="expense-date"
              accessibilityLabel={tAdd('dateLabel')}
              value={date}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              themeVariant={theme.scheme}
              onValueChange={(_event, selected) => onDateChange(selected)}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="subhead" color="textSecondary">
            {t('whoPaid')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm }}
          >
            {members.map((member) => {
              const isPayer = member.user_id === payerId;
              return (
                <Pressable
                  key={member.user_id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPayer }}
                  accessibilityLabel={nameOf(member)}
                  testID={`payer-${member.user_id}`}
                  onPress={() => onPayerChange(member.user_id)}
                  style={{
                    width: 76,
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: isPayer ? theme.colors.primary : 'transparent',
                    backgroundColor: isPayer ? theme.colors.primarySoft : theme.colors.surface,
                    opacity: isPayer ? 1 : 0.7,
                  }}
                >
                  <Avatar
                    uri={member.group_avatar_url ?? member.profiles.avatar_url}
                    name={nameOf(member)}
                    size={40}
                  />
                  <Text
                    variant="caption"
                    color={isPayer ? 'primary' : 'textSecondary'}
                    numberOfLines={1}
                    style={{ maxWidth: 68 }}
                  >
                    {nameOf(member)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="subhead" color="textSecondary">
            {t('splitMode')}
          </Text>
          <SegmentedControl
            testID="split-mode"
            values={[t('equal'), t('exact'), t('percent')]}
            selectedIndex={MODES.indexOf(splitMode)}
            onChange={(event) =>
              onSplitModeChange(MODES[event.nativeEvent.selectedSegmentIndex])
            }
            appearance={theme.scheme}
          />
        </View>

        <View
          style={{ gap: theme.spacing.sm }}
          onLayout={(event) => {
            allocationsY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text variant="subhead" color="textSecondary">
            {t('allocations')}
          </Text>
          {members.map((member) => {
            const involved = involvedIds.includes(member.user_id);
            const dimmed = splitMode === 'EQUAL' && !involved;
            return (
              <Pressable
                key={member.user_id}
                // Only the equal-split row is one tappable checkbox; in the
                // other modes the amount field must stay reachable on its own.
                accessible={splitMode === 'EQUAL'}
                accessibilityRole={splitMode === 'EQUAL' ? 'checkbox' : 'none'}
                accessibilityState={{ checked: involved }}
                testID={`split-row-${member.user_id}`}
                disabled={splitMode !== 'EQUAL'}
                onPress={() => onToggleInvolved(member.user_id)}
                onLayout={(event) => {
                  rowY.current[member.user_id] = event.nativeEvent.layout.y;
                }}
              >
                <Surface
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    opacity: dimmed ? 0.5 : 1,
                  }}
                >
                  {splitMode === 'EQUAL' ? (
                    <View
                      testID={`split-check-${member.user_id}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: involved ? theme.colors.primary : theme.colors.border,
                        backgroundColor: involved ? theme.colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {involved ? (
                        <Text variant="caption" color="onPrimary">
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <Avatar
                    uri={member.group_avatar_url ?? member.profiles.avatar_url}
                    name={nameOf(member)}
                    size={28}
                  />
                  <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                    {nameOf(member)}
                  </Text>

                  {splitMode === 'EQUAL' ? (
                    <Text variant="amountM" testID={`split-amount-${member.user_id}`}>
                      {involved ? formatMoney(splitAmounts[member.user_id] ?? 0, currency) : '—'}
                    </Text>
                  ) : splitMode === 'EXACT' ? (
                    numericInput(
                      member,
                      exactAmounts[member.user_id] ?? 0,
                      (value) => onExactChange(member.user_id, value),
                      currency,
                    )
                  ) : (
                    numericInput(
                      member,
                      percentAmounts[member.user_id] ?? 0,
                      (value) => onPercentChange(member.user_id, value),
                      '%',
                    )
                  )}
                </Surface>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <InputAccessoryView nativeID={accessoryId}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            backgroundColor: theme.colors.surfaceElevated,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <Button variant="ghost" title={tCommon('done')} onPress={() => Keyboard.dismiss()} />
        </View>
      </InputAccessoryView>

      {splitMode === 'EQUAL' ? null : (
        <View
          style={{
            paddingVertical: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Text
            variant="subhead"
            color={balanced ? 'positive' : 'negative'}
            testID="split-remaining"
            style={{ textAlign: 'center' }}
          >
            {remainingText}
          </Text>
        </View>
      )}
    </View>
  );
}

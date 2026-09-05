import { useSplitForm } from '@tally/shared/lib/split-form';
import { sendPush } from '@tally/shared/lib/push';
import { useExchangeRates } from '@tally/shared/queries/exchange-rates';
import {
  useAddExpense,
  useDeleteExpense,
  useExpense,
  useUpdateExpense,
} from '@tally/shared/queries/expenses';
import { useGroupDetails } from '@tally/shared/queries/group-details';
import { useSupabase } from '@tally/shared/supabase-context';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Calculator } from './Calculator';
import { SplitDetails, type SplitMode } from './SplitDetails';
import { memberDisplayName } from '@/components/groups/MemberStrip';
import { Button } from '@/components/ui/Button';
import { HeaderButton } from '@/components/ui/HeaderButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { resolveExchangeRate } from '@/lib/expense-rate';
import { useKeyboardOverlap } from '@/lib/keyboard';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

export type ExpenseFormProps = {
  groupId: string;
  /** Null creates a new expense; an id edits that one. */
  expenseId: string | null;
};

/** Midday keeps a date-only pick inside the intended day in every timezone. */
function atMidday(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function ExpenseForm({ groupId, expenseId }: ExpenseFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardOverlap = useKeyboardOverlap();
  const t = useT('AddExpense');
  const supabase = useSupabase();
  const userId = useAuthStore((s) => s.session?.user.id) ?? '';

  const details = useGroupDetails(groupId);
  const members = details.data?.members ?? [];
  const baseCurrency = details.data?.group.base_currency ?? 'TWD';

  const expense = useExpense(expenseId);
  const rates = useExchangeRates();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [step, setStep] = useState<'amount' | 'details'>(expenseId ? 'details' : 'amount');
  const [amount, setAmount] = useState(0);
  // null means "not picked yet", so the group's base currency (which arrives
  // with the query) can stay the default without an effect to copy it into state.
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  // A toast lives in the root layout, which a native modal covers, so the
  // form reports its own failures inline.
  const [error, setError] = useState<string | null>(null);

  const currency = pickedCurrency ?? baseCurrency;
  const form = useSplitForm(amount, members, userId, currency);

  // Loading an expense into the form during render (rather than in an effect)
  // avoids a first paint showing an empty form over the real values.
  const [loadedExpenseId, setLoadedExpenseId] = useState<string | null>(null);
  const data = expense.data;
  if (data && loadedExpenseId !== data.id) {
    setLoadedExpenseId(data.id);
    setAmount(Number(data.amount));
    setPickedCurrency(data.currency);
    setPickedDate(new Date(data.date));
    form.setValues({
      amount: Number(data.amount),
      currency: data.currency,
      description: data.description ?? '',
      payerId: data.payer_id,
      splits: data.splits.map((s) => ({ userId: s.user_id, amount: Number(s.owed_amount) })),
    });
  }

  // Unpicked means "today, right now": the real timestamp, not noon. A fixed
  // noon default sorted a same-day expense below same-day fixtures created
  // later in the day, hiding the freshly-saved card off the bottom of the
  // timeline without a scroll.
  const date = pickedDate ?? new Date();

  const locked = expense.data
    ? { currency: expense.data.currency, rate: Number(expense.data.exchange_rate) }
    : null;
  const rate = resolveExchangeRate({ currency, baseCurrency, rates: rates.data, locked });
  const showsLock = Boolean(
    locked && locked.currency === currency && locked.rate > 0 && currency !== baseCurrency,
  );

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/groups/${groupId}`);
  };

  const save = () => {
    // The keyboard can cover the button, so a tap may land while an allocation
    // field still holds focus; dismissing first commits nothing but the intent.
    Keyboard.dismiss();
    if (!form.isValid) return;
    setError(null);

    if (rate == null) {
      setError(`${t('ratesUnavailable')} ${t('ratesUnavailableDesc')}`);
      return;
    }

    const description = form.description || t('details');
    const common = {
      groupId,
      payerId: form.payerId,
      amount,
      currency,
      description,
      exchangeRate: rate,
      date: date.toISOString(),
      split: form.getSplits(),
    };

    if (expenseId) {
      updateExpense.mutate(
        {
          expenseId,
          ...common,
          payerName:
            members.find((m) => m.user_id === form.payerId)?.profiles.display_name ?? 'Unknown',
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast({ type: 'success', title: t('expenseUpdated') });
            close();
          },
          onError: (cause) => setError(`${t('failedToUpdate')} ${errorMessage(cause) ?? ''}`),
        },
      );
      return;
    }

    addExpense.mutate(common, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ type: 'success', title: t('expenseAdded') });

        const targets = members.filter((m) => m.user_id !== userId).map((m) => m.user_id);
        if (targets.length > 0) {
          const actor = members.find((m) => m.user_id === userId);
          sendPush(supabase, {
            userIds: targets,
            groupId,
            title: t('pushTitle'),
            body: t('pushBody', {
              name: actor ? memberDisplayName(actor) : 'Someone',
              description,
              amount: `${currency} ${amount}`,
            }),
            url: `/groups/${groupId}`,
          });
        }
      },
      onError: (cause) =>
        showToast({ type: 'error', title: t('failedToAdd'), message: errorMessage(cause) }),
    });
    // The optimistic card is already in the timeline; waiting for the insert
    // would leave the modal open over it.
    close();
  };

  const confirmDelete = () => {
    if (!expenseId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('deleteTitle'), t('deleteDesc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense.mutateAsync({
              expenseId,
              groupId,
              description: expense.data?.description ?? undefined,
              amount: expense.data ? Number(expense.data.amount) : undefined,
              currency: expense.data?.currency,
            });
            showToast({ type: 'success', title: t('expenseDeleted') });
            close();
          } catch (cause) {
            setError(`${t('failedToDelete')} ${errorMessage(cause) ?? ''}`);
          }
        },
      },
    ]);
  };

  const saving = addExpense.isPending || updateExpense.isPending;
  const loading = details.isLoading || (Boolean(expenseId) && expense.isLoading);

  const header = (
    <Stack.Screen
      options={{
        title: step === 'amount' ? t('amountStep') : t('detailsStep'),
        headerLeft: () => (
          <HeaderButton testID="expense-cancel" title={t('cancel')} onPress={close} />
        ),
        headerRight: () =>
          expenseId ? (
            <HeaderButton
              testID="expense-delete"
              title="🗑"
              accessibilityLabel={t('deleteExpense')}
              destructive
              onPress={confirmDelete}
            />
          ) : null,
      }}
    />
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.screenPadding,
          gap: theme.spacing.lg,
        }}
      >
        {header}
        <Skeleton height={80} radius={theme.radius.lg} />
        <Skeleton height={48} radius={theme.radius.lg} />
        <Skeleton height={200} radius={theme.radius.lg} />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.screenPadding,
        paddingTop: theme.spacing.lg,
        paddingBottom: insets.bottom + theme.spacing.lg,
        gap: theme.spacing.lg,
      }}
    >
      {header}

      {step === 'amount' ? (
        <Calculator
          currency={currency}
          baseCurrency={baseCurrency}
          rate={rate}
          rateLocked={showsLock}
          initialValue={amount}
          confirmLabel={t('next')}
          onCurrencyChange={setPickedCurrency}
          onConfirm={(value) => {
            setAmount(value);
            setStep('details');
          }}
        />
      ) : (
        <>
          <SplitDetails
            amount={amount}
            currency={currency}
            members={members}
            currentUserId={userId}
            description={form.description}
            onDescriptionChange={form.setDescription}
            date={date}
            onDateChange={(value) => setPickedDate(atMidday(value))}
            payerId={form.payerId}
            onPayerChange={form.setPayerId}
            splitMode={form.splitMode}
            onSplitModeChange={(mode: SplitMode) => form.setSplitMode(mode)}
            involvedIds={form.involvedIds}
            onToggleInvolved={form.toggleInvolved}
            splitAmounts={form.splitAmounts}
            exactAmounts={form.exactAmounts}
            onExactChange={form.handleAmountChange}
            percentAmounts={form.percentAmounts}
            onPercentChange={form.handlePercentChange}
            remainingExact={form.remainingExact}
            remainingPercent={form.remainingPercent}
            allocationValid={form.isValid}
          />

          {/* The keyboard must never cover the actions, or a tap on Save is
              swallowed by the keyboard and the edit is silently lost. */}
          <View
            style={{
              gap: theme.spacing.sm,
              paddingBottom: Math.max(keyboardOverlap - insets.bottom - theme.spacing.lg, 0),
            }}
          >
            {error ? (
              <Text variant="subhead" color="negative" testID="expense-error">
                {error}
              </Text>
            ) : null}

            {showsLock && rate ? (
              <Text variant="footnote" color="textSecondary" testID="locked-rate">
                🔒 {t('lockedRate')} ·{' '}
                {t('ratePreview', { from: currency, rate: rate.toFixed(4), to: baseCurrency })}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Button
                testID="expense-back-to-amount"
                variant="secondary"
                size="lg"
                title={t('amountStep')}
                onPress={() => {
                  Keyboard.dismiss();
                  setStep('amount');
                }}
              />
              <Button
                testID="expense-save"
                size="lg"
                style={{ flex: 1 }}
                loading={saving}
                disabled={!form.isValid || saving}
                title={form.isValid ? t('save') : t('checkAllocation')}
                onPress={save}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

import type { ActivityLog } from '@tally/shared/queries/activity-logs';

import type { Translate } from './i18n';
import type { ColorToken } from '@/theme/tokens';

const ACTION_DOT: Record<string, ColorToken> = {
  'expense.create': 'positive',
  'expense.restore': 'positive',
  'expense.update': 'primary',
  'expense.delete': 'negative',
  'settlement.create': 'warning',
  'settlement.undo': 'negative',
  'group.update': 'textSecondary',
  'group.archive': 'textSecondary',
  'group.unarchive': 'textSecondary',
};

const DESCRIPTION_KEY: Record<string, string> = {
  'expense.create': 'expenseCreated',
  'expense.update': 'expenseUpdated',
  'expense.delete': 'expenseDeleted',
  'expense.restore': 'expenseRestored',
  'settlement.create': 'settlementCreated',
  'settlement.undo': 'settlementUndone',
  'group.update': 'groupUpdated',
  'group.archive': 'groupArchived',
  'group.unarchive': 'groupUnarchived',
};

export function activityDotColor(action: string): ColorToken {
  return ACTION_DOT[action] ?? 'textSecondary';
}

export function activityActor(log: ActivityLog): string {
  return log.profiles?.display_name ?? 'Unknown';
}

type FieldChange = { old: unknown; new: unknown };

function isFieldChange(value: unknown): value is FieldChange {
  return typeof value === 'object' && value !== null && 'old' in value && 'new' in value;
}

type Repayment = {
  from_name?: string;
  fromName?: string;
  to_name?: string;
  toName?: string;
  amount?: number;
  currency?: string;
};

/** Web writes `fromName` for settle-all and `from_name` for one-to-one settles. */
function repaymentNames(repayment: Repayment): { from: string; to: string } {
  return {
    from: repayment.from_name ?? repayment.fromName ?? '',
    to: repayment.to_name ?? repayment.toName ?? '',
  };
}

export function activityDescription(log: ActivityLog, t: Translate): string {
  const actor = activityActor(log);
  const changes = log.changes ?? {};
  const key = DESCRIPTION_KEY[log.action];
  if (!key) return `${actor} — ${log.action}`;

  if (log.action === 'expense.update') {
    return t(key, { actor, description: String(changes.expenseName ?? '') });
  }
  if (key.startsWith('expense')) {
    return t(key, { actor, description: String(changes.description ?? '') });
  }
  return t(key, { actor });
}

/** Secondary lines under the description: amounts, field diffs, repayment rows. */
export function activityDetails(
  log: ActivityLog,
  t: Translate,
  formatMoney: (amount: number, currency: string) => string,
): string[] {
  const changes = log.changes ?? {};

  if (
    log.action === 'expense.create' ||
    log.action === 'expense.delete' ||
    log.action === 'expense.restore'
  ) {
    const { amount, currency } = changes;
    if (typeof amount === 'number' && typeof currency === 'string') {
      return [formatMoney(amount, currency)];
    }
    return [];
  }

  if (log.action === 'expense.update' || log.action === 'group.update') {
    return Object.entries(changes)
      .filter(([, value]) => isFieldChange(value))
      .map(([field, value]) => {
        const change = value as FieldChange;
        return t('changedTo', {
          field: t(field),
          old: String(change.old),
          new: String(change.new),
        });
      });
  }

  if (log.action === 'settlement.create') {
    const repayments = changes.repayments;
    if (!Array.isArray(repayments)) return [];
    return (repayments as Repayment[]).map((repayment) => {
      const { from, to } = repaymentNames(repayment);
      const money =
        typeof repayment.amount === 'number' && repayment.currency
          ? formatMoney(repayment.amount, repayment.currency)
          : '';
      return `${from} → ${to}${money ? `: ${money}` : ''}`;
    });
  }

  return [];
}

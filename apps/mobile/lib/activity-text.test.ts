import type { ActivityLog } from '@tally/shared/queries/activity-logs';
import { describe, expect, it } from 'vitest';

import { activityDescription, activityDetails, activityDotColor } from './activity-text';

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

const money = (amount: number, currency: string) => `${currency} ${amount}`;

function log(action: string, changes: Record<string, unknown> = {}): ActivityLog {
  return {
    id: '1',
    group_id: 'g',
    actor_id: 'u1',
    action,
    entity_type: 'expense',
    entity_id: null,
    changes,
    created_at: '2026-09-05T10:00:00Z',
    profiles: { display_name: 'Ada', avatar_url: null },
  };
}

describe('activityDescription', () => {
  it('names the expense for create-style actions', () => {
    expect(activityDescription(log('expense.create', { description: 'Ramen' }), t)).toBe(
      'expenseCreated({"actor":"Ada","description":"Ramen"})',
    );
  });

  it('reads an update’s name from expenseName', () => {
    expect(activityDescription(log('expense.update', { expenseName: 'Ramen' }), t)).toBe(
      'expenseUpdated({"actor":"Ada","description":"Ramen"})',
    );
  });

  it('falls back to the raw action when unknown', () => {
    expect(activityDescription(log('mystery.action'), t)).toBe('Ada — mystery.action');
  });
});

describe('activityDetails', () => {
  it('formats the amount of a created expense', () => {
    expect(activityDetails(log('expense.create', { amount: 600, currency: 'TWD' }), t, money)).toEqual(
      ['TWD 600'],
    );
  });

  it('lists changed fields of an update', () => {
    const details = activityDetails(
      log('expense.update', { amount: { old: 1, new: 2 }, expenseName: 'Ramen' }),
      t,
      money,
    );
    expect(details).toEqual(['changedTo({"field":"amount","old":"1","new":"2"})']);
  });

  it('accepts both repayment name casings', () => {
    const details = activityDetails(
      log('settlement.create', {
        repayments: [
          { from_name: 'Ada', to_name: 'Bob', amount: 300, currency: 'TWD' },
          { fromName: 'Cy', toName: 'Ada', amount: 100, currency: 'TWD' },
        ],
      }),
      t,
      money,
    );
    expect(details).toEqual(['Ada → Bob: TWD 300', 'Cy → Ada: TWD 100']);
  });
});

describe('activityDotColor', () => {
  it('falls back for unknown actions', () => {
    expect(activityDotColor('expense.delete')).toBe('negative');
    expect(activityDotColor('mystery.action')).toBe('textSecondary');
  });
});

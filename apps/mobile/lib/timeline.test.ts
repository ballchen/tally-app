import type { GroupExpense, GroupSettlement } from '@tally/shared/queries/group-details';
import { describe, expect, it } from 'vitest';

import { buildTimeline, toMonthSections } from './timeline';

function expense(id: string, date: string, overrides: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id,
    group_id: 'g',
    payer_id: 'u1',
    amount: 100,
    currency: 'TWD',
    description: id,
    exchange_rate: 1,
    date,
    type: 'expense',
    settlement_id: null,
    deleted_at: null,
    created_by: 'u1',
    payer: null,
    expense_splits: [],
    ...overrides,
  };
}

function settlement(id: string, createdAt: string): GroupSettlement {
  return { id, group_id: 'g', created_by: 'u1', created_at: createdAt, creator: null };
}

describe('buildTimeline', () => {
  it('sorts expenses and settlements newest first', () => {
    const items = buildTimeline(
      [expense('a', '2026-08-01'), expense('b', '2026-09-10')],
      [settlement('s1', '2026-09-05T00:00:00Z')],
    );

    expect(items.map((i) => i.key)).toEqual(['expense-b', 'settlement-s1', 'expense-a']);
  });

  it('folds repayments into their settlement instead of listing them', () => {
    const repayment = expense('r1', '2026-09-05', {
      type: 'repayment',
      settlement_id: 's1',
      amount: 300,
    });
    const items = buildTimeline([repayment], [settlement('s1', '2026-09-05T00:00:00Z')]);

    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.kind).toBe('settlement');
    if (item.kind === 'settlement') {
      expect(item.repayments.map((r) => r.id)).toEqual(['r1']);
      expect(item.total).toBe(300);
    }
  });

  it('drops repayments that lost their settlement', () => {
    const orphan = expense('r1', '2026-09-05', { type: 'repayment', settlement_id: null });
    expect(buildTimeline([orphan], [])).toEqual([]);
  });
});

describe('toMonthSections', () => {
  it('groups consecutive items of the same month', () => {
    const items = buildTimeline(
      [expense('a', '2026-09-10'), expense('b', '2026-09-01'), expense('c', '2026-08-20')],
      [],
    );
    const sections = toMonthSections(
      items,
      (date) => date.slice(0, 7),
      (date) => date.slice(0, 7),
    );

    expect(sections.map((s) => [s.key, s.data.length])).toEqual([
      ['2026-09', 2],
      ['2026-08', 1],
    ]);
  });
});

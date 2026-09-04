import type { GroupExpense, GroupSettlement } from '@tally/shared/queries/group-details';

export type TimelineItem =
  | { kind: 'expense'; key: string; date: string; expense: GroupExpense }
  | { kind: 'repayment'; key: string; date: string; expense: GroupExpense }
  | {
      kind: 'settlement';
      key: string;
      date: string;
      settlement: GroupSettlement;
      repayments: GroupExpense[];
      total: number;
    };

export type TimelineSection = { key: string; title: string; data: TimelineItem[] };

/**
 * Merges expenses and settlements into one newest-first list. Repayment
 * expenses are folded into the settlement they belong to; a repayment whose
 * settlement was deleted (or never linked) still represents money that moved,
 * so it surfaces as its own card rather than disappearing from the timeline.
 */
export function buildTimeline(
  expenses: GroupExpense[] | undefined,
  settlements: GroupSettlement[] | undefined,
): TimelineItem[] {
  const repaymentsBySettlement = new Map<string, GroupExpense[]>();
  const items: TimelineItem[] = [];

  for (const expense of expenses ?? []) {
    if (expense.type === 'repayment' && expense.settlement_id) {
      const bucket = repaymentsBySettlement.get(expense.settlement_id) ?? [];
      bucket.push(expense);
      repaymentsBySettlement.set(expense.settlement_id, bucket);
      continue;
    }
    if (expense.type === 'repayment') {
      items.push({ kind: 'repayment', key: `repayment-${expense.id}`, date: expense.date, expense });
      continue;
    }
    items.push({ kind: 'expense', key: `expense-${expense.id}`, date: expense.date, expense });
  }

  for (const settlement of settlements ?? []) {
    const repayments = repaymentsBySettlement.get(settlement.id) ?? [];
    items.push({
      kind: 'settlement',
      key: `settlement-${settlement.id}`,
      date: settlement.created_at,
      settlement,
      repayments,
      total: repayments.reduce((sum, r) => sum + Number(r.amount), 0),
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Groups a already-sorted timeline into consecutive month sections. */
export function toMonthSections(
  items: TimelineItem[],
  keyOf: (date: string) => string,
  titleOf: (date: string) => string,
): TimelineSection[] {
  const sections: TimelineSection[] = [];

  for (const item of items) {
    const key = keyOf(item.date);
    const last = sections[sections.length - 1];
    if (last?.key === key) {
      last.data.push(item);
    } else {
      sections.push({ key, title: titleOf(item.date), data: [item] });
    }
  }

  return sections;
}

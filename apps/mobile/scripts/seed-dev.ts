/**
 * Seeds the Phase 3 and Phase 4 fixtures (three test accounts and a set of groups
 * covering every list filter, membership case, and group-detail state) into the
 * remote Supabase project.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node --experimental-strip-types apps/mobile/scripts/seed-dev.ts
 *
 * SUPABASE_KEYS_JSON may point at the output of
 * `supabase projects api-keys --project-ref <ref> -o json` instead, so the key
 * never has to be pasted onto a command line or into a checked-in file.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));

function readEnvFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'))
        .map((line) => {
          const eq = line.indexOf('=');
          return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

function readServiceRoleKeyFromKeysJson(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const keys = JSON.parse(readFileSync(path, 'utf8')) as
    | { keys: { id: string; api_key: string }[] }
    | { id: string; api_key: string }[];
  const list = Array.isArray(keys) ? keys : keys.keys;
  return list.find((k) => k.id === 'service_role')?.api_key;
}

const fileEnv = readEnvFile(resolve(here, '../.env'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? fileEnv.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  readServiceRoleKeyFromKeysJson(process.env.SUPABASE_KEYS_JSON);

if (!url || !serviceRoleKey) {
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEYS_JSON (and EXPO_PUBLIC_SUPABASE_URL or apps/mobile/.env)',
  );
}

const db: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const ACCOUNTS = {
  a: { email: 'phase2-test@example.com', password: 'Phase2Test!2026', displayName: 'Phase Three A' },
  b: { email: 'phase3-test-b@example.com', password: 'Phase3TestB!2026', displayName: 'Phase Three B' },
  c: { email: 'phase4-test-c@example.com', password: 'Phase4TestC!2026', displayName: 'Phase Four C' },
} as const;

async function findUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureAccount(account: { email: string; password: string; displayName: string }) {
  let id = await findUserByEmail(account.email);
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
    console.log(`created auth user ${account.email} -> ${id}`);
  }
  const { error } = await db.from('profiles').upsert({ id, display_name: account.displayName });
  if (error) throw error;
  return id;
}

type Who = 'a' | 'b' | 'c';

type SeedExpense = {
  description: string;
  payer: Who;
  amount: number;
  splits: Who[];
  /** Defaults to the group's TWD base currency. */
  currency?: string;
  /** Rate into the base currency; the seeded owed_amount_base is locked with it. */
  exchangeRate?: number;
  date?: string;
};

/** A completed settlement, so the timeline has a settlement card to expand and undo. */
type SeedSettlement = { from: Who; to: Who; amount: number };

type Seed = {
  code: string;
  name: string;
  owner: Who;
  members: Who[];
  archived?: boolean;
  hiddenFor?: Who[];
  expenses?: SeedExpense[];
  settlement?: SeedSettlement;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The 15th of the previous month, so it always lands under its own timeline header. */
function lastMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 4, 0, 0)).toISOString();
}

/**
 * Nets out to C owes B NT$ 12,608 and A owes B NT$ 11,688, with one completed
 * settlement already on the timeline. Each settling flow gets a copy of its
 * own: a settlement a failed flow leaves behind zeroes those numbers out for
 * every other flow reading the same group, and Maestro shuffles the order.
 */
function threeCurrencyTrip(code: string, name: string): Seed {
  return {
    code,
    name,
    owner: 'a',
    members: ['a', 'b', 'c'],
    expenses: [
      {
        description: 'Sushi omakase',
        payer: 'a',
        amount: 12000,
        currency: 'JPY',
        exchangeRate: 0.21,
        splits: ['a', 'b', 'c'],
      },
      {
        description: 'Hotel booking',
        payer: 'b',
        amount: 1234.5,
        currency: 'USD',
        exchangeRate: 32,
        splits: ['a', 'b', 'c'],
      },
      { description: 'Airport bus', payer: 'c', amount: 600, splits: ['a', 'b', 'c'] },
    ],
    settlement: { from: 'c', to: 'b', amount: 1000 },
  };
}

/** 60 expenses three days apart, so the timeline spans six month sections. */
function paginationExpenses(): SeedExpense[] {
  return Array.from({ length: 60 }, (_, index) => ({
    description: `Expense ${String(index + 1).padStart(2, '0')}`,
    payer: index % 2 === 0 ? ('a' as Who) : ('b' as Who),
    amount: 100 + index,
    splits: ['a', 'b'] as Who[],
    date: new Date(Date.now() - index * 3 * DAY_MS).toISOString(),
  }));
}

const SEEDS: Seed[] = [
  {
    code: 'phase3jp',
    name: 'Japan Trip',
    owner: 'a',
    members: ['a', 'b'],
    expenses: [{ description: 'Ramen dinner', payer: 'a', amount: 600, splits: ['a', 'b'] }],
  },
  { code: 'phase3br', name: 'Weekend Brunch', owner: 'b', members: ['a', 'b'] },
  { code: 'phase3sk', name: 'Old Ski Trip', owner: 'a', members: ['a', 'b'], archived: true },
  { code: 'phase3ss', name: 'Secret Santa', owner: 'a', members: ['a', 'b'], hiddenFor: ['a'] },
  { code: 'phase3lv', name: 'Leave Test', owner: 'a', members: ['a', 'b'] },
  { code: 'phase3rm', name: 'Remove Test', owner: 'a', members: ['a', 'b'] },
  { code: 'phase3jn', name: 'Join Test', owner: 'a', members: ['a'] },
  { code: 'phase3in', name: 'Invite Only', owner: 'b', members: ['b'] },

  // Phase 4 fixtures.
  threeCurrencyTrip('phase4kt', 'Kyoto Trip'),
  threeCurrencyTrip('phase4sa', 'Settle All Trip'),
  threeCurrencyTrip('phase4su', 'Settle Undo Trip'),
  threeCurrencyTrip('phase4al', 'Activity Log Trip'),
  {
    code: 'phase4dt',
    name: 'Debt Test',
    owner: 'b',
    members: ['a', 'b'],
    expenses: [{ description: 'Concert tickets', payer: 'b', amount: 900, splits: ['a', 'b'] }],
  },
  {
    code: 'phase4pg',
    name: 'Sixty Expenses',
    owner: 'a',
    members: ['a', 'b'],
    expenses: paginationExpenses(),
  },
  // Phase 5 fixtures.
  // `phase5ex` is for read-only flows only. Every flow that saves an expense
  // gets a group of its own: Maestro shuffles flow order and has no `finally`,
  // so a row a failed flow leaves behind must not be able to reach another one.
  {
    code: 'phase5ex',
    name: 'Expense Lab',
    owner: 'a',
    members: ['a', 'b', 'c'],
    expenses: [{ description: 'Welcome drinks', payer: 'a', amount: 300, splits: ['a', 'b', 'c'] }],
  },
  {
    code: 'phase5eq',
    name: 'Equal Lab',
    owner: 'a',
    members: ['a', 'b', 'c'],
  },
  {
    code: 'phase5kb',
    name: 'Keyboard Lab',
    owner: 'a',
    members: ['a', 'b', 'c'],
  },
  {
    code: 'phase5dt',
    name: 'Date Lab',
    owner: 'a',
    members: ['a', 'b', 'c'],
    // A current-month expense, so a backdated save lands under a second month
    // header instead of being the only row in the timeline.
    expenses: [{ description: 'Welcome drinks', payer: 'a', amount: 300, splits: ['a', 'b', 'c'] }],
  },
  {
    code: 'phase5ed',
    name: 'Edit Lab',
    owner: 'a',
    members: ['a', 'b'],
    // E7: a last-month JPY expense whose rate is deliberately far from today's,
    // so re-saving it with a fresh rate would visibly change owed_amount_base.
    expenses: [
      {
        description: 'Old Tokyo dinner',
        payer: 'a',
        amount: 8000,
        currency: 'JPY',
        exchangeRate: 0.25,
        splits: ['a', 'b'],
        date: lastMonth(),
      },
    ],
  },
  {
    code: 'phase4ar',
    name: 'Archived Trip',
    owner: 'a',
    members: ['a', 'b'],
    archived: true,
    // Two expenses bracket a completed settlement so the timeline shows a
    // real "Settled by" card while the outstanding balance still nets to 400.
    expenses: [
      { description: 'Cable car', payer: 'a', amount: 800, splits: ['a', 'b'] },
      { description: 'Return cable car', payer: 'a', amount: 800, splits: ['a', 'b'] },
    ],
    settlement: { from: 'b', to: 'a', amount: 400 },
  },
];

async function main() {
  const ids: Record<Who, string> = {
    a: await ensureAccount(ACCOUNTS.a),
    b: await ensureAccount(ACCOUNTS.b),
    c: await ensureAccount(ACCOUNTS.c),
  };

  const codes = SEEDS.map((s) => s.code);
  const { error: cleanupError } = await db.from('groups').delete().in('invite_code', codes);
  if (cleanupError) throw cleanupError;

  for (const seed of SEEDS) {
    const { data: group, error } = await db
      .from('groups')
      .insert({
        name: seed.name,
        base_currency: 'TWD',
        invite_code: seed.code,
        created_by: ids[seed.owner],
        archived_at: seed.archived ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: memberError } = await db.from('group_members').insert(
      seed.members.map((m) => ({
        group_id: group.id,
        user_id: ids[m],
        hidden_at: seed.hiddenFor?.includes(m) ? new Date().toISOString() : null,
      })),
    );
    if (memberError) throw memberError;

    for (const seedExpense of seed.expenses ?? []) {
      const rate = seedExpense.exchangeRate ?? 1;
      const share = seedExpense.amount / seedExpense.splits.length;
      const { data: expense, error: expenseError } = await db
        .from('expenses')
        .insert({
          group_id: group.id,
          payer_id: ids[seedExpense.payer],
          created_by: ids[seedExpense.payer],
          description: seedExpense.description,
          amount: seedExpense.amount,
          currency: seedExpense.currency ?? 'TWD',
          exchange_rate: rate,
          type: 'expense',
          date: seedExpense.date ?? new Date().toISOString(),
        })
        .select('id')
        .single();
      if (expenseError) throw expenseError;

      const { error: splitError } = await db.from('expense_splits').insert(
        seedExpense.splits.map((m) => ({
          expense_id: expense.id,
          user_id: ids[m],
          owed_amount: share,
          owed_amount_base: share * rate,
        })),
      );
      if (splitError) throw splitError;
    }

    if (seed.settlement) {
      const { from, to, amount } = seed.settlement;
      const { data: settlement, error: settlementError } = await db
        .from('settlements')
        .insert({ group_id: group.id, created_by: ids[from] })
        .select('id')
        .single();
      if (settlementError) throw settlementError;

      const { data: repayment, error: repaymentError } = await db
        .from('expenses')
        .insert({
          group_id: group.id,
          payer_id: ids[from],
          created_by: ids[from],
          description: 'Settlement',
          amount,
          currency: 'TWD',
          exchange_rate: 1,
          type: 'repayment',
          settlement_id: settlement.id,
        })
        .select('id')
        .single();
      if (repaymentError) throw repaymentError;

      const { error: repaymentSplitError } = await db.from('expense_splits').insert({
        expense_id: repayment.id,
        user_id: ids[to],
        owed_amount: amount,
        owed_amount_base: amount,
      });
      if (repaymentSplitError) throw repaymentSplitError;
    }

    console.log(`seeded ${seed.name} (${seed.code}) -> ${group.id}`);
  }

  console.log('\nuser ids:', ids);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

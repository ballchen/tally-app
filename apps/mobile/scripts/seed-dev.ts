/**
 * Seeds the Phase 3 fixtures (two test accounts and a set of groups covering every
 * list filter and membership case) into the remote Supabase project.
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

type Who = 'a' | 'b';

type Seed = {
  code: string;
  name: string;
  owner: Who;
  members: Who[];
  archived?: boolean;
  hiddenFor?: Who[];
  expense?: { payer: Who; amount: number; splits: Who[] };
};

const SEEDS: Seed[] = [
  {
    code: 'phase3jp',
    name: 'Japan Trip',
    owner: 'a',
    members: ['a', 'b'],
    expense: { payer: 'a', amount: 600, splits: ['a', 'b'] },
  },
  { code: 'phase3br', name: 'Weekend Brunch', owner: 'b', members: ['a', 'b'] },
  { code: 'phase3sk', name: 'Old Ski Trip', owner: 'a', members: ['a', 'b'], archived: true },
  { code: 'phase3ss', name: 'Secret Santa', owner: 'a', members: ['a', 'b'], hiddenFor: ['a'] },
  { code: 'phase3lv', name: 'Leave Test', owner: 'a', members: ['a', 'b'] },
  { code: 'phase3rm', name: 'Remove Test', owner: 'a', members: ['a', 'b'] },
  { code: 'phase3jn', name: 'Join Test', owner: 'a', members: ['a'] },
  { code: 'phase3in', name: 'Invite Only', owner: 'b', members: ['b'] },
];

async function main() {
  const ids: Record<Who, string> = {
    a: await ensureAccount(ACCOUNTS.a),
    b: await ensureAccount(ACCOUNTS.b),
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

    if (seed.expense) {
      const share = seed.expense.amount / seed.expense.splits.length;
      const { data: expense, error: expenseError } = await db
        .from('expenses')
        .insert({
          group_id: group.id,
          payer_id: ids[seed.expense.payer],
          created_by: ids[seed.expense.payer],
          description: 'Ramen dinner',
          amount: seed.expense.amount,
          currency: 'TWD',
          exchange_rate: 1,
          type: 'expense',
        })
        .select('id')
        .single();
      if (expenseError) throw expenseError;

      const { error: splitError } = await db.from('expense_splits').insert(
        seed.expense.splits.map((m) => ({
          expense_id: expense.id,
          user_id: ids[m],
          owed_amount: share,
          owed_amount_base: share,
        })),
      );
      if (splitError) throw splitError;
    }

    console.log(`seeded ${seed.name} (${seed.code}) -> ${group.id}`);
  }

  console.log('\nuser ids:', ids);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

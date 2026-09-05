/**
 * Cross-checks the `get_my_group_balances` RPC against the TypeScript
 * `calculateNetBalances` the group list also renders from. A drift between the
 * two silently shows the wrong "you owe" on the home screen, and no unit test
 * can catch it: one side is SQL in a migration, the other is in packages/shared.
 *
 * Usage:
 *   SUPABASE_KEYS_JSON=/tmp/keys.json \
 *   TALLY_TEST_EMAIL=... TALLY_TEST_PASSWORD=... \
 *     node --experimental-strip-types apps/mobile/scripts/verify-balances-parity.ts
 *
 * Prints one line per group and exits non-zero on any mismatch.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { calculateNetBalances, type BalanceExpense } from '@tally/shared/balances';

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
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  readServiceRoleKeyFromKeysJson(process.env.SUPABASE_KEYS_JSON);
const email = process.env.TALLY_TEST_EMAIL;
const password = process.env.TALLY_TEST_PASSWORD;

if (!url || !anonKey || !serviceRoleKey || !email || !password) {
  throw new Error(
    'Need EXPO_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEYS_JSON), TALLY_TEST_EMAIL and TALLY_TEST_PASSWORD',
  );
}

// The RPC is `auth.uid()`-scoped, so it has to run as the signed-in user;
// reading the raw rows to recompute needs the service role.
const asUser: SupabaseClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const asAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: auth, error: signInError } = await asUser.auth.signInWithPassword({ email, password });
if (signInError || !auth.user) throw new Error(`Sign in failed: ${signInError?.message}`);
const userId = auth.user.id;

const { data: rpcRows, error: rpcError } = await asUser.rpc('get_my_group_balances');
if (rpcError) throw new Error(`get_my_group_balances failed: ${rpcError.message}`);

const fromRpc = new Map<string, number>(
  (rpcRows as { group_id: string; net_balance: number }[]).map((row) => [
    row.group_id,
    Number(row.net_balance),
  ]),
);

// A cent of drift is base-currency rounding, not a logic difference.
const TOLERANCE = 0.005;
let failures = 0;

for (const [groupId, rpcBalance] of fromRpc) {
  const { data: group, error: groupError } = await asAdmin
    .from('groups')
    .select('name, base_currency')
    .eq('id', groupId)
    .single();
  if (groupError || !group) throw new Error(`Group ${groupId}: ${groupError?.message}`);

  const { data: members, error: memberError } = await asAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  if (memberError) throw new Error(`Members ${groupId}: ${memberError.message}`);

  const { data: expenses, error: expenseError } = await asAdmin
    .from('expenses')
    .select('payer_id, currency, expense_splits(user_id, owed_amount, owed_amount_base)')
    .eq('group_id', groupId)
    .is('deleted_at', null);
  if (expenseError) throw new Error(`Expenses ${groupId}: ${expenseError.message}`);

  const balances = calculateNetBalances(
    (expenses ?? []) as BalanceExpense[],
    members ?? [],
    group.base_currency,
  );
  const tsBalance = balances[userId] ?? 0;
  const drift = Math.abs(tsBalance - rpcBalance);
  const ok = drift <= TOLERANCE;
  if (!ok) failures += 1;

  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${group.name.padEnd(20)} rpc=${rpcBalance.toFixed(2).padStart(10)} ts=${tsBalance
      .toFixed(2)
      .padStart(10)} drift=${drift.toFixed(4)}`,
  );
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${fromRpc.size} groups, ${failures} mismatched`);
process.exit(failures === 0 ? 0 : 1);

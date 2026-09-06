/**
 * Inspects and cleans the expenses a Maestro flow writes, using the service role.
 *
 * Usage:
 *   SUPABASE_KEYS_JSON=/tmp/keys.json node --experimental-strip-types \
 *     apps/mobile/scripts/expense-probe.ts <invite_code> [--purge <description>]
 *
 * Without --purge it prints every expense in the group with its splits, which is
 * how the acceptance checks compare `owed_amount_base` before and after an edit.
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
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEYS_JSON');
}

const db: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [code, flag, needle] = process.argv.slice(2);
if (!code) throw new Error('Usage: expense-probe.ts <invite_code> [--purge <description>]');

const { data: group, error: groupError } = await db
  .from('groups')
  .select('id, name, base_currency')
  .eq('invite_code', code)
  .single();
if (groupError) throw groupError;

const { data: expenses, error } = await db
  .from('expenses')
  .select('id, description, amount, currency, exchange_rate, date, deleted_at')
  .eq('group_id', group.id)
  .order('date', { ascending: false });
if (error) throw error;

if (flag === '--purge') {
  const doomed = (expenses ?? []).filter((e) => (e.description ?? '').includes(needle ?? ''));
  for (const e of doomed) {
    const { error: deleteError } = await db.from('expenses').delete().eq('id', e.id);
    if (deleteError) throw deleteError;
    console.log(`purged ${e.description} (${e.id})`);
  }
  console.log(`purged ${doomed.length} expense(s) from ${group.name}`);
} else {
  console.log(`${group.name} (${group.base_currency})`);
  for (const e of expenses ?? []) {
    const { data: splits } = await db
      .from('expense_splits')
      .select('user_id, owed_amount, owed_amount_base')
      .eq('expense_id', e.id)
      .order('user_id');
    console.log(
      `- ${e.description} ${e.amount} ${e.currency} rate=${e.exchange_rate} date=${e.date}` +
        `${e.deleted_at ? ' [deleted]' : ''}`,
    );
    for (const s of splits ?? []) {
      console.log(`    ${s.user_id} owed=${s.owed_amount} base=${s.owed_amount_base}`);
    }
  }
}

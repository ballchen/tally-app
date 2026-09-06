/**
 * Checks that editing an expense never re-prices it: `exchange_rate` and every
 * `owed_amount_base` must be byte-for-byte what they were before the edit.
 *
 * Usage:
 *   SUPABASE_KEYS_JSON=/tmp/keys.json node --experimental-strip-types \
 *     apps/mobile/scripts/verify-rate-lock.ts <invite_code> --snapshot <file>
 *   # run apps/mobile/.maestro/phase5-detail-and-edit.yaml
 *   SUPABASE_KEYS_JSON=/tmp/keys.json node --experimental-strip-types \
 *     apps/mobile/scripts/verify-rate-lock.ts <invite_code> --compare <file>
 *
 * Exits non-zero when a rate or a base amount moved.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

type Snapshot = Record<
  string,
  { description: string | null; rate: string; bases: Record<string, string> }
>;

async function readSnapshot(code: string): Promise<Snapshot> {
  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id')
    .eq('invite_code', code)
    .single();
  if (groupError) throw groupError;

  const { data: expenses, error } = await db
    .from('expenses')
    .select('id, description, exchange_rate')
    .eq('group_id', group.id)
    .is('deleted_at', null);
  if (error) throw error;

  const snapshot: Snapshot = {};
  for (const expense of expenses ?? []) {
    const { data: splits, error: splitError } = await db
      .from('expense_splits')
      .select('user_id, owed_amount_base')
      .eq('expense_id', expense.id)
      .order('user_id');
    if (splitError) throw splitError;

    snapshot[expense.id] = {
      description: expense.description,
      rate: String(expense.exchange_rate),
      bases: Object.fromEntries(
        (splits ?? []).map((s) => [s.user_id, String(s.owed_amount_base)]),
      ),
    };
  }
  return snapshot;
}

const [code, mode, file] = process.argv.slice(2);
if (!code || (mode !== '--snapshot' && mode !== '--compare') || !file) {
  throw new Error('Usage: verify-rate-lock.ts <invite_code> --snapshot|--compare <file>');
}

const current = await readSnapshot(code);

if (mode === '--snapshot') {
  writeFileSync(file, JSON.stringify(current, null, 2));
  console.log(`snapshot of ${Object.keys(current).length} expense(s) written to ${file}`);
} else {
  const before = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  const failures: string[] = [];

  for (const [id, was] of Object.entries(before)) {
    const now = current[id];
    if (!now) {
      failures.push(`${id} (${was.description}) is gone`);
      continue;
    }
    if (now.rate !== was.rate) {
      failures.push(`${id} (${now.description}) rate ${was.rate} -> ${now.rate}`);
    }
    for (const [userId, base] of Object.entries(was.bases)) {
      if (now.bases[userId] !== base) {
        failures.push(
          `${id} (${now.description}) ${userId} base ${base} -> ${now.bases[userId]}`,
        );
      }
    }
    console.log(`${id} "${now.description}" rate=${now.rate} bases=${JSON.stringify(now.bases)}`);
  }

  if (failures.length > 0) {
    console.error(`FAIL\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`PASS — ${Object.keys(before).length} expense(s) kept their rate and base amounts`);
}

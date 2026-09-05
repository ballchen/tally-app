/**
 * Prints the device_tokens rows, so the sign-in / sign-out halves of F2 can be
 * compared. `--purge-sim` drops the fake Simulator tokens left behind by older
 * debug builds.
 *
 * Usage: node --experimental-strip-types apps/mobile/scripts/push-tokens.ts [--purge-sim]
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

if (process.argv.includes('--purge-sim')) {
  const { error } = await db.from('device_tokens').delete().like('expo_token', 'ExponentPushToken[sim-%');
  if (error) throw error;
}

const { data, error } = await db
  .from('device_tokens')
  .select('user_id, expo_token, platform, created_at')
  .order('created_at');
if (error) throw error;

console.log(JSON.stringify(data, null, 2));

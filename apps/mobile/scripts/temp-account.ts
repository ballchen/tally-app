/**
 * Fixture for the delete-account flow (F6): a throwaway account that is a member
 * of someone else's group, created fresh before the flow and asserted gone after.
 *
 * It deliberately owns nothing: `groups.created_by` references `profiles(id)` with
 * no ON DELETE action, so deleting a user who still owns a group fails in Postgres
 * and the Edge Function returns 500.
 *
 * Usage:
 *   node --experimental-strip-types apps/mobile/scripts/temp-account.ts create
 *   node --experimental-strip-types apps/mobile/scripts/temp-account.ts check
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));

export const TEMP_ACCOUNT = {
  email: 'phase6-temp@example.com',
  password: 'Phase6Temp!2026',
  displayName: 'Phase Six Temp',
  groupName: 'Temp Delete Group',
  inviteCode: 'phase6tm',
  /** The group's owner; the throwaway account only joins it. */
  ownerEmail: 'phase2-test@example.com',
};

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

async function create() {
  // The group goes first: it may still reference the previous run's account.
  await db.from('groups').delete().eq('invite_code', TEMP_ACCOUNT.inviteCode);

  const existing = await findUserByEmail(TEMP_ACCOUNT.email);
  if (existing) {
    const { error: deleteError } = await db.auth.admin.deleteUser(existing);
    if (deleteError) throw deleteError;
  }

  const { data, error } = await db.auth.admin.createUser({
    email: TEMP_ACCOUNT.email,
    password: TEMP_ACCOUNT.password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  await db.from('profiles').upsert({ id, display_name: TEMP_ACCOUNT.displayName });

  const ownerId = await findUserByEmail(TEMP_ACCOUNT.ownerEmail);
  if (!ownerId) throw new Error(`Missing owner account ${TEMP_ACCOUNT.ownerEmail}`);

  const { data: group, error: groupError } = await db
    .from('groups')
    .insert({
      name: TEMP_ACCOUNT.groupName,
      base_currency: 'TWD',
      invite_code: TEMP_ACCOUNT.inviteCode,
      created_by: ownerId,
    })
    .select('id')
    .single();
  if (groupError) throw groupError;

  await db
    .from('group_members')
    .insert([
      { group_id: group.id, user_id: ownerId },
      { group_id: group.id, user_id: id },
    ]);

  console.log(`created ${TEMP_ACCOUNT.email} (${id}) as a member of group ${group.id}`);
}

async function check() {
  const id = await findUserByEmail(TEMP_ACCOUNT.email);
  const { data: profiles } = await db
    .from('profiles')
    .select('id')
    .eq('display_name', TEMP_ACCOUNT.displayName);
  const { data: group } = await db
    .from('groups')
    .select('id')
    .eq('invite_code', TEMP_ACCOUNT.inviteCode)
    .single();
  const { data: members } = await db
    .from('group_members')
    .select('user_id')
    .eq('group_id', group?.id ?? '');

  console.log(
    JSON.stringify(
      {
        authUser: id,
        profileRows: profiles?.length ?? 0,
        fixtureGroupMembers: members?.map((m) => m.user_id) ?? [],
      },
      null,
      2,
    ),
  );
  if (id || profiles?.length) process.exitCode = 1;
}

const command = process.argv[2];
if (command === 'create') await create();
else if (command === 'check') await check();
else throw new Error('Usage: temp-account.ts <create|check>');

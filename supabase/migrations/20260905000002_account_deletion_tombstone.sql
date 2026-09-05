-- Account deletion keeps a tombstone profile.
-- Migration: 2026-09-05
--
-- expenses.payer_id, expense_splits.user_id and groups.created_by reference
-- profiles without ON DELETE, so deleting a profile would break every group the
-- user ever paid in. Instead the auth user is deleted and the profile stays
-- behind anonymised (display_name / avatar cleared, deleted_at set), which
-- keeps other members' balances and history intact.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The profile must survive auth.users deletion, so drop the cascading FK.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Anonymise + detach in one transaction. Called by the delete-account Edge
-- Function with the service role right before auth.admin.deleteUser.
CREATE OR REPLACE FUNCTION tombstone_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group record;
  v_heir uuid;
BEGIN
  -- Groups the user owns: hand ownership to the longest-standing other member,
  -- or soft-delete the group when nobody else is left.
  FOR v_group IN
    SELECT id FROM groups WHERE created_by = p_user_id AND deleted_at IS NULL
  LOOP
    SELECT user_id INTO v_heir
    FROM group_members
    WHERE group_id = v_group.id AND user_id <> p_user_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_heir IS NULL THEN
      UPDATE groups SET deleted_at = now() WHERE id = v_group.id;
    ELSE
      UPDATE groups SET created_by = v_heir WHERE id = v_group.id;
    END IF;
  END LOOP;

  DELETE FROM group_members WHERE user_id = p_user_id;
  DELETE FROM device_tokens WHERE user_id = p_user_id;
  DELETE FROM push_subscriptions WHERE user_id = p_user_id;

  UPDATE profiles
  SET display_name = 'Deleted user',
      avatar_url = NULL,
      gender = NULL,
      deleted_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION tombstone_profile(uuid) FROM PUBLIC, anon, authenticated;

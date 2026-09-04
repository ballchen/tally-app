-- Mobile support: Expo push tokens, per-group balance RPC, leave/remove member
-- Migration: 2026-09-05

-- ====================
-- 1. device_tokens (Expo push)
-- ====================
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token text UNIQUE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own device tokens" ON device_tokens;
CREATE POLICY "Manage own device tokens" ON device_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ====================
-- 2. Net balance helpers. Mirrors packages/shared calculateNetBalances:
--    payer gains the sum of splits, each split user owes their share,
--    all in base currency via owed_amount_base (legacy rows fall back to
--    owed_amount * exchange_rate).
-- ====================
CREATE OR REPLACE FUNCTION member_net_balance(p_group_id uuid, p_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN e.payer_id = p_user_id THEN base ELSE 0 END
    - CASE WHEN s.user_id = p_user_id THEN base ELSE 0 END
  ), 0)
  FROM expenses e
  JOIN expense_splits s ON s.expense_id = e.id
  CROSS JOIN LATERAL (
    SELECT COALESCE(s.owed_amount_base, s.owed_amount * COALESCE(e.exchange_rate, 1)) AS base
  ) b
  WHERE e.group_id = p_group_id
    AND e.deleted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION member_net_balance(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION member_net_balance(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_my_group_balances()
RETURNS TABLE (group_id uuid, net_balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT gm.group_id, member_net_balance(gm.group_id, auth.uid())
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.user_id = auth.uid()
    AND g.deleted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION get_my_group_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_group_balances() TO authenticated;

-- ====================
-- 3. leave_group / remove_member
--    A member may only leave (or be removed) when their net balance is settled,
--    otherwise the group's debts would silently lose a counterparty.
-- ====================
CREATE OR REPLACE FUNCTION leave_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  SELECT created_by INTO v_owner FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  IF v_owner = v_user_id THEN
    RAISE EXCEPTION 'Owner cannot leave the group';
  END IF;
  IF abs(member_net_balance(p_group_id, v_user_id)) >= 0.01 THEN
    RAISE EXCEPTION 'Balance must be settled before leaving';
  END IF;

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION leave_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION leave_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION remove_member(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by INTO v_owner FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  IF v_owner IS NULL OR v_owner <> v_caller THEN
    RAISE EXCEPTION 'Only the group owner can remove members';
  END IF;
  IF p_user_id = v_owner THEN
    RAISE EXCEPTION 'Owner cannot be removed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;
  IF abs(member_net_balance(p_group_id, p_user_id)) >= 0.01 THEN
    RAISE EXCEPTION 'Balance must be settled before removing';
  END IF;

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_member(uuid, uuid) TO authenticated;

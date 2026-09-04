-- Harden settlement/activity RPCs, lock base currency, expose settlements to realtime
-- Migration: 2026-09-04

-- ====================
-- 1. settle_debt_rpc: validate inputs, lock base amount
-- ====================
CREATE OR REPLACE FUNCTION settle_debt_rpc(
  p_group_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount numeric,
  p_currency text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settlement_id uuid;
  v_expense_id uuid;
  v_base_currency text;
BEGIN
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_debtor_id = p_creditor_id THEN
    RAISE EXCEPTION 'Debtor and creditor must differ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_debtor_id)
     OR NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_creditor_id) THEN
    RAISE EXCEPTION 'Both parties must be group members';
  END IF;

  SELECT base_currency INTO v_base_currency FROM groups WHERE id = p_group_id AND deleted_at IS NULL AND archived_at IS NULL;
  IF v_base_currency IS NULL THEN
    RAISE EXCEPTION 'Group is archived or deleted';
  END IF;
  -- Repayments are always in base currency so owed_amount_base needs no conversion.
  IF p_currency IS DISTINCT FROM v_base_currency THEN
    RAISE EXCEPTION 'Settlements must use the group base currency (%)', v_base_currency;
  END IF;

  INSERT INTO settlements (group_id, created_by)
  VALUES (p_group_id, auth.uid())
  RETURNING id INTO v_settlement_id;

  INSERT INTO expenses (
    group_id, payer_id, amount, currency, description, type, settlement_id, created_by, exchange_rate
  ) VALUES (
    p_group_id, p_debtor_id, p_amount, v_base_currency, 'Settlement', 'repayment', v_settlement_id, auth.uid(), 1
  ) RETURNING id INTO v_expense_id;

  INSERT INTO expense_splits (expense_id, user_id, owed_amount, owed_amount_base)
  VALUES (v_expense_id, p_creditor_id, p_amount, p_amount);

  RETURN v_settlement_id;
END;
$$;

-- ====================
-- 2. settle_group_expenses: validate every repayment, lock base amount
-- ====================
CREATE OR REPLACE FUNCTION settle_group_expenses(
  p_group_id uuid,
  p_repayments jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settlement_id uuid;
  v_expense_id uuid;
  v_repayment jsonb;
  v_base_currency text;
  v_from uuid;
  v_to uuid;
  v_amount numeric;
BEGIN
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;
  IF p_repayments IS NULL OR jsonb_typeof(p_repayments) <> 'array' OR jsonb_array_length(p_repayments) = 0 THEN
    RAISE EXCEPTION 'No repayments supplied';
  END IF;

  SELECT base_currency INTO v_base_currency FROM groups WHERE id = p_group_id AND deleted_at IS NULL AND archived_at IS NULL;
  IF v_base_currency IS NULL THEN
    RAISE EXCEPTION 'Group is archived or deleted';
  END IF;

  INSERT INTO settlements (group_id, created_by)
  VALUES (p_group_id, auth.uid())
  RETURNING id INTO v_settlement_id;

  FOR v_repayment IN SELECT * FROM jsonb_array_elements(p_repayments)
  LOOP
    v_from := (v_repayment->>'from')::uuid;
    v_to := (v_repayment->>'to')::uuid;
    v_amount := (v_repayment->>'amount')::numeric;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Amount must be positive';
    END IF;
    IF v_from = v_to THEN
      RAISE EXCEPTION 'Debtor and creditor must differ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_from)
       OR NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_to) THEN
      RAISE EXCEPTION 'Both parties must be group members';
    END IF;

    INSERT INTO expenses (
      group_id, payer_id, amount, currency, description, type, settlement_id, created_by, exchange_rate
    ) VALUES (
      p_group_id, v_from, v_amount, v_base_currency, 'Settlement', 'repayment', v_settlement_id, auth.uid(), 1
    ) RETURNING id INTO v_expense_id;

    INSERT INTO expense_splits (expense_id, user_id, owed_amount, owed_amount_base)
    VALUES (v_expense_id, v_to, v_amount, v_amount);
  END LOOP;

  RETURN v_settlement_id;
END;
$$;

-- ====================
-- 3. log_activity: only members may write to a group's audit trail
-- ====================
CREATE OR REPLACE FUNCTION log_activity(
  p_group_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  INSERT INTO activity_logs (group_id, actor_id, action, entity_type, entity_id, changes)
  VALUES (p_group_id, auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_changes, '{}'::jsonb))
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- ====================
-- 4. get_group_by_invite_code: hide deleted/archived groups, expose base_currency
-- ====================
CREATE OR REPLACE FUNCTION get_group_by_invite_code(code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object('id', id, 'name', name, 'base_currency', base_currency)
  INTO result
  FROM groups
  WHERE invite_code = code
    AND deleted_at IS NULL
    AND archived_at IS NULL
  LIMIT 1;
  RETURN result;
END;
$$;

-- ====================
-- 5. Lock base currency once the group has expenses.
-- owed_amount_base is denominated in the base currency at write time; changing
-- the base afterwards would silently mis-add every locked amount.
-- ====================
CREATE OR REPLACE FUNCTION prevent_base_currency_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency
     AND EXISTS (SELECT 1 FROM expenses WHERE group_id = OLD.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Base currency cannot change after expenses exist';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_base_currency_change ON groups;
CREATE TRIGGER trg_prevent_base_currency_change
  BEFORE UPDATE OF base_currency ON groups
  FOR EACH ROW EXECUTE FUNCTION prevent_base_currency_change();

-- ====================
-- 6. Realtime for settlements so undo by another member propagates.
-- REPLICA IDENTITY FULL makes DELETE payloads carry group_id for channel filters.
-- ====================
ALTER TABLE settlements REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
  END IF;
END;
$$;

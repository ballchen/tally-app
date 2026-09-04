-- Allow editing an expense's date. NULL keeps the existing value so older
-- callers that do not send p_date keep working.
-- Migration: 2026-09-05

DROP FUNCTION IF EXISTS public.update_expense_details(uuid, uuid, numeric, text, text, jsonb, numeric);

CREATE OR REPLACE FUNCTION update_expense_details(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_splits jsonb,
  p_exchange_rate numeric DEFAULT 1.0,
  p_date timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_id uuid;
  v_deleted_at timestamptz;
BEGIN
  SELECT group_id, deleted_at INTO v_group_id, v_deleted_at
  FROM expenses
  WHERE id = p_expense_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update deleted expense';
  END IF;
  IF NOT is_group_member(v_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE expenses
  SET payer_id = p_payer_id,
      amount = p_amount,
      currency = p_currency,
      description = p_description,
      exchange_rate = p_exchange_rate,
      date = COALESCE(p_date, date)
  WHERE id = p_expense_id
    AND deleted_at IS NULL;

  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO expense_splits (expense_id, user_id, owed_amount, owed_amount_base)
  SELECT
    p_expense_id,
    (x->>'user_id')::uuid,
    (x->>'amount')::numeric,
    (x->>'amount_base')::numeric
  FROM jsonb_array_elements(p_splits) AS x;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_expense_details(uuid, uuid, numeric, text, text, jsonb, numeric, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_expense_details(uuid, uuid, numeric, text, text, jsonb, numeric, timestamptz) TO authenticated;

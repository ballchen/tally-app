-- Update RPC functions to work with soft delete
-- Migration: 2026-01-29

-- Update the update_expense_details function to prevent updating deleted expenses
CREATE OR REPLACE FUNCTION update_expense_details(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_splits jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY definer AS $$
DECLARE
  v_group_id uuid;
  v_deleted_at timestamptz;
BEGIN
  -- Get group_id and deleted_at status
  SELECT group_id, deleted_at INTO v_group_id, v_deleted_at
  FROM expenses
  WHERE id = p_expense_id;

  -- Check if expense exists and is not deleted
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update deleted expense';
  END IF;

  -- Check if user is a member of the group
  IF NOT is_group_member(v_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  -- Update expense
  UPDATE expenses
  SET payer_id = p_payer_id,
      amount = p_amount,
      currency = p_currency,
      description = p_description
  WHERE id = p_expense_id
    AND deleted_at IS NULL;  -- Additional safety check

  -- Delete old splits
  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  -- Insert new splits
  INSERT INTO expense_splits (expense_id, user_id, owed_amount)
  SELECT p_expense_id, (x->>'user_id')::uuid, (x->>'amount')::numeric
  FROM jsonb_array_elements(p_splits) AS x;
END;
$$;

-- Fix Settlement Logic - 2026-02-12
-- Problem: settle_debt_rpc marks splits as settled, but simplified debts may include indirect debts
-- Solution: Repayments should participate in balance calculation, not marking splits

-- ====================
-- 1. UPDATE settle_debt_rpc
-- ====================
-- Now only creates repayment expense, does NOT mark splits
-- The repayment will naturally offset the debt in balance calculation

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
BEGIN
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  -- Create settlement record
  INSERT INTO settlements (group_id, created_by)
  VALUES (p_group_id, auth.uid())
  RETURNING id INTO v_settlement_id;

  -- Create repayment expense (debtor pays creditor)
  -- payer_id = debtor (the one who pays)
  -- split user_id = creditor (the one who receives)
  INSERT INTO expenses (
    group_id, payer_id, amount, currency, description, type, settlement_id, created_by
  ) VALUES (
    p_group_id, p_debtor_id, p_amount, p_currency, 'Settlement', 'repayment', v_settlement_id, auth.uid()
  ) RETURNING id INTO v_expense_id;

  -- Create split for creditor (they "owe" this amount, which cancels their credit)
  INSERT INTO expense_splits (expense_id, user_id, owed_amount)
  VALUES (v_expense_id, p_creditor_id, p_amount);

  RETURN v_settlement_id;
END;
$$;

-- ====================
-- 2. CREATE settle_group_expenses (Settle All)
-- ====================
-- Settles all debts in one transaction

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
BEGIN
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  -- Get group's base currency
  SELECT base_currency INTO v_base_currency
  FROM groups WHERE id = p_group_id;

  -- Create single settlement record for all repayments
  INSERT INTO settlements (group_id, created_by)
  VALUES (p_group_id, auth.uid())
  RETURNING id INTO v_settlement_id;

  -- Process each repayment
  FOR v_repayment IN SELECT * FROM jsonb_array_elements(p_repayments)
  LOOP
    -- Create repayment expense
    INSERT INTO expenses (
      group_id, payer_id, amount, currency, description, type, settlement_id, created_by
    ) VALUES (
      p_group_id,
      (v_repayment->>'from')::uuid,  -- debtor pays
      (v_repayment->>'amount')::numeric,
      v_base_currency,
      'Settlement',
      'repayment',
      v_settlement_id,
      auth.uid()
    ) RETURNING id INTO v_expense_id;

    -- Create split for creditor
    INSERT INTO expense_splits (expense_id, user_id, owed_amount)
    VALUES (v_expense_id, (v_repayment->>'to')::uuid, (v_repayment->>'amount')::numeric);
  END LOOP;

  RETURN v_settlement_id;
END;
$$;

-- ====================
-- 3. UPDATE undo_settlement
-- ====================
-- When undoing, we just delete the settlement record
-- CASCADE will delete associated repayment expenses and their splits
-- Original expense splits remain untouched (they were never marked)

-- No change needed - the existing undo_settlement already works correctly
-- because it deletes the settlement, which cascades to delete the repayment expenses

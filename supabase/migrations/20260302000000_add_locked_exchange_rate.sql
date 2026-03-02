-- Lock exchange rate at expense creation time
-- Migration: 2026-03-02
--
-- Problem: useBalances re-converts owed_amount using live rates on every render.
-- When rates change after a settlement, previously settled debts can reappear.
-- Fix: store owed_amount_base (base-currency equivalent locked at creation time)
-- on each expense split. Balance calculation uses the locked value instead.

-- ====================
-- Part A: Add column
-- ====================
ALTER TABLE expense_splits ADD COLUMN IF NOT EXISTS owed_amount_base numeric(12,4);

-- ====================
-- Part B: Migrate expenses.exchange_rate for historical cross-currency expenses
-- Currently all rows default to 1.0; cross-currency expenses need the real rate.
-- We identify them by: currency != base_currency AND exchange_rate = 1.0
-- ====================
UPDATE expenses e
SET exchange_rate = ROUND(
  CASE
    -- Expense in USD → just need USD-to-base rate
    WHEN e.currency = 'USD' THEN
      ((r.rates -> ('USD' || g.base_currency)) ->> 'Exrate')::numeric
    -- Base is USD → 1 / (USD-to-expense rate)
    WHEN g.base_currency = 'USD' THEN
      1.0 / ((r.rates -> ('USD' || e.currency)) ->> 'Exrate')::numeric
    -- Cross rate: expense → USD → base
    ELSE
      ((r.rates -> ('USD' || g.base_currency)) ->> 'Exrate')::numeric
      / ((r.rates -> ('USD' || e.currency)) ->> 'Exrate')::numeric
  END,
  6
)
FROM groups g
CROSS JOIN LATERAL (SELECT rates FROM exchange_rates ORDER BY date DESC LIMIT 1) r
WHERE e.group_id = g.id
  AND e.deleted_at IS NULL
  AND e.currency != g.base_currency   -- cross-currency only
  AND e.exchange_rate = 1.0;          -- never set (still at default), not intentionally 1:1

-- ====================
-- Part C: Populate owed_amount_base for same-currency splits (exact, no conversion)
-- ====================
UPDATE expense_splits es
SET owed_amount_base = es.owed_amount
FROM expenses e
JOIN groups g ON e.group_id = g.id
WHERE es.expense_id = e.id
  AND e.currency = g.base_currency;

-- ====================
-- Part D: Populate owed_amount_base for cross-currency splits
-- Runs after Part B, so expenses.exchange_rate is now correctly set.
-- ====================
UPDATE expense_splits es
SET owed_amount_base = ROUND(es.owed_amount * e.exchange_rate, 4)
FROM expenses e
JOIN groups g ON e.group_id = g.id
WHERE es.expense_id = e.id
  AND e.currency != g.base_currency
  AND es.owed_amount_base IS NULL;

-- ====================
-- Part E: Update update_expense_details RPC to accept exchange_rate and amount_base
-- ====================
CREATE OR REPLACE FUNCTION update_expense_details(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_splits jsonb,
  p_exchange_rate numeric DEFAULT 1.0
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

  -- Update expense (including locked exchange_rate)
  UPDATE expenses
  SET payer_id = p_payer_id,
      amount = p_amount,
      currency = p_currency,
      description = p_description,
      exchange_rate = p_exchange_rate
  WHERE id = p_expense_id
    AND deleted_at IS NULL;

  -- Delete old splits
  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  -- Insert new splits with locked base amounts
  INSERT INTO expense_splits (expense_id, user_id, owed_amount, owed_amount_base)
  SELECT
    p_expense_id,
    (x->>'user_id')::uuid,
    (x->>'amount')::numeric,
    (x->>'amount_base')::numeric
  FROM jsonb_array_elements(p_splits) AS x;
END;
$$;

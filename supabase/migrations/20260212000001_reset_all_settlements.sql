-- Reset All Settlements - 2026-02-12
-- This migration removes all existing settlements to reset data before applying new settlement logic
--
-- What this does:
-- 1. Deletes all settlements records
-- 2. CASCADE deletes all repayment expenses (expenses with settlement_id)
-- 3. CASCADE deletes all expense_splits belonging to those repayment expenses
-- 4. SET NULL on expense_splits.settlement_id for original expenses
--
-- Result: All groups return to "unsettled" state

-- Delete all settlements (cascades will handle the rest)
DELETE FROM settlements;

-- Verify: Clear any orphaned settlement_id references (should already be NULL from SET NULL cascade)
UPDATE expense_splits SET settlement_id = NULL WHERE settlement_id IS NOT NULL;

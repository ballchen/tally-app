-- Simplified UPDATE policy - Final Solution
-- Migration: 2026-01-29
--
-- Strategy:
-- 1. Use simple, reliable checks in USING and WITH CHECK
-- 2. Add a trigger to prevent group_id changes (better than complex WITH CHECK)
-- 3. Fix any remaining data issues

-- Step 1: Ensure all expenses have created_by set
UPDATE expenses
SET created_by = payer_id
WHERE created_by IS NULL;

-- Step 2: Create trigger to prevent group_id changes
CREATE OR REPLACE FUNCTION prevent_expense_group_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent changing group_id after creation
  IF OLD.group_id IS DISTINCT FROM NEW.group_id THEN
    RAISE EXCEPTION 'Cannot change expense group_id';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS prevent_expense_group_change_trigger ON expenses;

CREATE TRIGGER prevent_expense_group_change_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_expense_group_change();

-- Step 3: Simplify UPDATE policy
-- Now that trigger prevents group_id changes, we can use simple checks
DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;

CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  -- User must be a group member to update
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = expenses.group_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  -- After update, user must still be a group member
  -- Since trigger prevents group_id changes, this is equivalent to USING
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = expenses.group_id
    AND user_id = auth.uid()
  )
);

-- Verify the setup
SELECT
  'UPDATE policy' as component,
  policyname,
  'OK' as status
FROM pg_policies
WHERE tablename = 'expenses' AND cmd = 'UPDATE'
UNION ALL
SELECT
  'Trigger' as component,
  tgname as policyname,
  'OK' as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'expenses' AND tgname = 'prevent_expense_group_change_trigger';

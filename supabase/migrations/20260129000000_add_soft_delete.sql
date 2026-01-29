-- Add soft delete support to expenses table
-- Migration: 2026-01-29

-- Step 1: Add deleted_at column to expenses table
ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;

-- Step 2: Create index for better query performance when filtering deleted expenses
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;

-- Step 3: Fix existing data - set created_by to payer_id where it's NULL
-- This ensures the delete policy works correctly for existing records
UPDATE expenses
SET created_by = payer_id
WHERE created_by IS NULL;

-- Step 4: Update RLS policies to exclude soft-deleted expenses

-- Drop existing "View expenses" policy
DROP POLICY IF EXISTS "View expenses" ON expenses;

-- Recreate with soft delete filter
CREATE POLICY "View expenses" ON expenses
FOR SELECT
USING (
  is_group_member(group_id)
  AND deleted_at IS NULL
);

-- Update "Delete expenses" policy to be more permissive (any group member can delete)
DROP POLICY IF EXISTS "Delete expenses" ON expenses;

CREATE POLICY "Delete expenses" ON expenses
FOR DELETE
USING (
  is_group_member(group_id)
  AND (payer_id = auth.uid() OR created_by = auth.uid())
);

-- Step 5: Add UPDATE policy for soft delete operation
CREATE POLICY "Soft delete expenses" ON expenses
FOR UPDATE
USING (
  is_group_member(group_id)
  AND (payer_id = auth.uid() OR created_by = auth.uid())
)
WITH CHECK (
  is_group_member(group_id)
);

-- Step 6: Optional - Create a view for active expenses (commonly used pattern)
CREATE OR REPLACE VIEW active_expenses AS
SELECT * FROM expenses WHERE deleted_at IS NULL;

-- Step 7: Optional - Create function to restore deleted expenses
CREATE OR REPLACE FUNCTION restore_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Get group_id for permission check
  SELECT group_id INTO v_group_id
  FROM expenses
  WHERE id = p_expense_id;

  IF NOT is_group_member(v_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Restore the expense
  UPDATE expenses
  SET deleted_at = NULL
  WHERE id = p_expense_id;
END;
$$;

-- Step 8: Create function for permanent delete (admin use)
CREATE OR REPLACE FUNCTION permanent_delete_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Get group_id for permission check
  SELECT group_id INTO v_group_id
  FROM expenses
  WHERE id = p_expense_id;

  IF NOT is_group_member(v_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Permanently delete the expense (and cascades to expense_splits)
  DELETE FROM expenses WHERE id = p_expense_id;
END;
$$;

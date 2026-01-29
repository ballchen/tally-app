-- Fix delete permissions - allow all group members to delete expenses
-- Migration: 2026-01-29

-- Step 1: Ensure deleted_at column exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'expenses'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;
        CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;
    END IF;
END $$;

-- Step 2: Fix existing data - set created_by to payer_id where it's NULL (idempotent)
UPDATE expenses
SET created_by = payer_id
WHERE created_by IS NULL;

-- Step 3: Drop existing UPDATE policies
DROP POLICY IF EXISTS "Update expenses" ON expenses;
DROP POLICY IF EXISTS "Soft delete expenses" ON expenses;

-- Step 4: Create new UPDATE policy that allows ALL group members to update/delete
CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  is_group_member(group_id)
)
WITH CHECK (
  is_group_member(group_id)
);

-- Step 5: Update DELETE policy to allow all group members (for consistency)
DROP POLICY IF EXISTS "Delete expenses" ON expenses;

CREATE POLICY "Group members can delete expenses" ON expenses
FOR DELETE
USING (
  is_group_member(group_id)
);

-- Step 6: Recreate SELECT policy to exclude soft-deleted expenses
DROP POLICY IF EXISTS "View expenses" ON expenses;

CREATE POLICY "View expenses" ON expenses
FOR SELECT
USING (
  is_group_member(group_id)
  AND deleted_at IS NULL
);

-- Verify policies
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE ''
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE ''
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'expenses'
ORDER BY policyname;

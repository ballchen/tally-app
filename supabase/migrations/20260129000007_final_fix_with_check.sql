-- Final fix for UPDATE policy WITH CHECK clause
-- Migration: 2026-01-29
--
-- Root Issue: Subquery-based WITH CHECK fails intermittently
-- Solution: Use USING clause condition in WITH CHECK for consistency
--
-- The key insight: Whatever passes USING should pass WITH CHECK
-- when we're not modifying group_id. This ensures consistency.

-- First, ensure all expenses have created_by set (fix any remaining NULLs)
UPDATE expenses
SET created_by = payer_id
WHERE created_by IS NULL;

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;

-- Create new UPDATE policy with consistent USING and WITH CHECK
-- Both clauses check the same thing: is the user a group member?
CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  -- User must be a member of the group (checking current row)
  is_group_member(group_id)
)
WITH CHECK (
  -- User must still be a member after update (checking updated row)
  -- Since we don't allow group_id changes, this should always match USING
  is_group_member(group_id)
);

-- Verify the policy
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'expenses'
ORDER BY cmd, policyname;

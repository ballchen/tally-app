-- Fix UPDATE policy WITH CHECK clause - Final Solution
-- Migration: 2026-01-29
--
-- Issue: Setting deleted_at fails WITH CHECK when using is_group_member()
-- Root Cause: WITH CHECK evaluates in a different context and may check
--             if the updated row is still visible under SELECT policy
--
-- Solution: Use WITH CHECK to ensure group_id is not modified
--           This allows soft delete while preventing malicious group transfers

DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;

CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  -- User must be a member of the group to update
  is_group_member(group_id)
)
WITH CHECK (
  -- Ensure group_id is not modified during update
  -- This allows updating deleted_at and other fields safely
  group_id = (
    SELECT e.group_id FROM expenses e WHERE e.id = expenses.id
  )
);

-- Verify the policy
SELECT
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'expenses'
  AND cmd = 'UPDATE';

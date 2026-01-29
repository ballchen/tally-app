-- Fix UPDATE policy WITH CHECK using EXISTS
-- Migration: 2026-01-29
--
-- Previous approach using subquery failed in some cases
-- New approach: Use EXISTS with direct group_id reference
-- This is more robust and works in all UPDATE scenarios

DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;

CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  is_group_member(group_id)
)
WITH CHECK (
  -- Use EXISTS to check membership using the updated row's group_id
  -- This is more stable than subquery comparison
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = expenses.group_id
    AND user_id = auth.uid()
  )
);

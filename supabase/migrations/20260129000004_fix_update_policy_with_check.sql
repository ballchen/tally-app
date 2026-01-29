-- Fix UPDATE policy WITH CHECK clause
-- Migration: 2026-01-29
-- This fixes the issue where WITH CHECK clause can't properly evaluate is_group_member()

-- Drop and recreate the UPDATE policy with explicit EXISTS check
DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;

CREATE POLICY "Group members can update expenses" ON expenses
FOR UPDATE
USING (
  is_group_member(group_id)
)
WITH CHECK (
  -- Use explicit EXISTS instead of function call for WITH CHECK
  -- This ensures proper context evaluation
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = expenses.group_id
    AND user_id = auth.uid()
  )
);

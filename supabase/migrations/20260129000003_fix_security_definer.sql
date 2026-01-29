-- Fix is_group_member and is_expense_participant functions
-- Change from SECURITY DEFINER to SECURITY INVOKER
-- This ensures auth.uid() works correctly inside RLS policies
-- Migration: 2026-01-29

-- IMPORTANT: Use CREATE OR REPLACE to avoid dropping and recreating
-- This preserves all dependent policies

-- Fix is_group_member function
CREATE OR REPLACE FUNCTION is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = _group_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Fix is_expense_participant function
CREATE OR REPLACE FUNCTION is_expense_participant(_expense_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM expense_splits
    WHERE expense_id = _expense_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Verify the functions work correctly
SELECT
  'Testing is_group_member' as test,
  is_group_member('ad754b75-57f4-4d6b-a058-1a0cd8c55b25'::uuid) as result,
  auth.uid() as current_user
UNION ALL
SELECT
  'Auth context check' as test,
  NULL as result,
  auth.uid() as current_user;

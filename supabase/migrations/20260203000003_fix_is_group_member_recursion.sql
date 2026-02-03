-- Fix is_group_member() function to prevent RLS recursion
-- The function is called by groups table RLS policy, which triggers group_members RLS policy
-- This creates infinite recursion. Solution: Make function SECURITY DEFINER to bypass RLS

-- Recreate with SECURITY DEFINER to bypass RLS (using CREATE OR REPLACE to avoid dependency issues)
CREATE OR REPLACE FUNCTION is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  -- This query now runs with definer privileges, bypassing RLS on group_members
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = _group_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Set owner to postgres to ensure BYPASSRLS privilege
ALTER FUNCTION is_group_member(uuid) OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_group_member(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION is_group_member IS 'Checks if current user is a member of a group. Runs with SECURITY DEFINER to bypass RLS and prevent recursion.';

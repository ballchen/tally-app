-- Create a secure function to check group membership without triggering recursion
-- This function runs with the privileges of the creator (SECURITY DEFINER), bypassing RLS
CREATE OR REPLACE FUNCTION get_auth_user_groups()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid();
$$;

-- Drop the recursive policy
DROP POLICY "Users can view members of their groups" ON group_members;

-- Create the new non-recursive policy using the function
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (
    group_id IN (SELECT get_auth_user_groups())
  );

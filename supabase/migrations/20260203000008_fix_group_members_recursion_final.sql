-- Fix infinite recursion in group_members RLS policy
-- The problem: group_members RLS policy queries group_members table, causing recursion
-- Solution: Simplify policy to only allow viewing own records

-- Drop the problematic policy
DROP POLICY IF EXISTS "View members" ON group_members;

-- Create simple policy that doesn't cause recursion
-- Users can ONLY view their own membership records directly
-- To view other members, they must use the RPC function get_group_members_batch()
CREATE POLICY "View members" ON group_members
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Add comment explaining the simplified approach
COMMENT ON POLICY "View members" ON group_members IS
'Users can only view their own membership records. To view other group members, use the get_group_members_batch() RPC function which bypasses RLS.';

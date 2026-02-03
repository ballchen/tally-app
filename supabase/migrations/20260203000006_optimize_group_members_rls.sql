-- Optimize group_members RLS policy to avoid function calls per row
-- Replace is_group_member() function call with direct subquery for better performance

-- Drop existing policy
DROP POLICY IF EXISTS "View members" ON group_members;

-- Create optimized policy
-- Users can view:
-- 1. Their own membership records (auth.uid() = user_id)
-- 2. Other members in groups where they are also a member (EXISTS subquery)
CREATE POLICY "View members" ON group_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
      AND gm2.user_id = auth.uid()
    )
  );

-- Ensure index exists for the subquery optimization
CREATE INDEX IF NOT EXISTS idx_group_members_group_user_lookup
ON group_members(group_id, user_id);

-- Add comment
COMMENT ON POLICY "View members" ON group_members IS
'Users can view their own membership records and other members in their groups. Uses EXISTS subquery for better performance instead of function calls.';

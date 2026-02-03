-- Optimize groups RLS policy to avoid function calls per row
-- Instead of calling is_group_member() for each row, use a direct subquery

-- Drop existing policy
DROP POLICY IF EXISTS "Groups viewable by members" ON groups;

-- Create optimized policy using EXISTS subquery instead of function call
-- This allows PostgreSQL to optimize the query plan better
CREATE POLICY "Groups viewable by members" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Add index to optimize the EXISTS subquery if not already exists
CREATE INDEX IF NOT EXISTS idx_group_members_group_user_lookup
ON group_members(group_id, user_id);

-- Also add comment
COMMENT ON POLICY "Groups viewable by members" ON groups IS
'Users can view groups where they are members. Uses EXISTS subquery for better performance.';

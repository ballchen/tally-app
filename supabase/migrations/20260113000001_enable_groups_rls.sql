-- Enable RLS on groups table
-- This migration should be applied after middleware.ts is in place to properly refresh auth tokens

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view their groups
CREATE POLICY "Groups viewable by members" ON groups
  FOR SELECT USING (is_group_member(id));

-- Policy: Authenticated users can create groups
CREATE POLICY "Users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Only creator can update group
CREATE POLICY "Creators can update groups" ON groups
  FOR UPDATE USING (created_by = auth.uid());

-- Policy: Only creator can delete group
CREATE POLICY "Creators can delete groups" ON groups
  FOR DELETE USING (created_by = auth.uid());

-- Fix recursive RLS policy causing stack depth limit exceeded error
-- Creates RPC function to fetch group members without triggering RLS recursion

-- Create RPC function to fetch group members batch
CREATE OR REPLACE FUNCTION get_group_members_batch(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  user_id uuid,
  group_nickname text,
  group_avatar_url text,
  joined_at timestamptz,
  profile_id uuid,
  profile_display_name text,
  profile_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return members only for groups where caller is a member
  RETURN QUERY
  SELECT
    gm.group_id,
    gm.user_id,
    gm.group_nickname,
    gm.group_avatar_url,
    gm.joined_at,
    p.id as profile_id,
    p.display_name as profile_display_name,
    p.avatar_url as profile_avatar_url
  FROM group_members gm
  INNER JOIN profiles p ON p.id = gm.user_id
  WHERE gm.group_id = ANY(p_group_ids)
    -- Security check: only return if caller is member
    AND EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = gm.group_id
      AND gm2.user_id = v_user_id
    );
END;
$$;

-- Performance optimization index
CREATE INDEX IF NOT EXISTS idx_group_members_group_user
ON group_members(group_id, user_id);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_group_members_batch(uuid[]) TO authenticated;

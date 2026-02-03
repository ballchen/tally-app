-- Fix ambiguous column reference in get_group_members_batch RPC function
-- The issue is that RETURNS TABLE columns have the same names as table columns

DROP FUNCTION IF EXISTS get_group_members_batch(uuid[]);

CREATE FUNCTION get_group_members_batch(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  user_id uuid,
  group_nickname text,
  group_avatar_url text,
  joined_at timestamptz,
  hidden_at timestamptz,
  profile_id uuid,
  profile_display_name text,
  profile_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_user_groups uuid[];
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- First, get all groups where user is a member
  -- Use table alias to avoid ambiguity with RETURNS TABLE column names
  SELECT array_agg(DISTINCT gm.group_id)
  INTO v_user_groups
  FROM group_members gm
  WHERE gm.user_id = v_user_id
    AND gm.group_id = ANY(p_group_ids);

  -- If user is not member of any requested groups, return empty
  IF v_user_groups IS NULL THEN
    RETURN;
  END IF;

  -- Now fetch all members for those groups
  RETURN QUERY
  SELECT
    gm.group_id,
    gm.user_id,
    gm.group_nickname,
    gm.group_avatar_url,
    gm.joined_at,
    gm.hidden_at,
    p.id as profile_id,
    p.display_name as profile_display_name,
    p.avatar_url as profile_avatar_url
  FROM group_members gm
  INNER JOIN profiles p ON p.id = gm.user_id
  WHERE gm.group_id = ANY(v_user_groups);
END;
$$;

-- Set function owner to postgres
ALTER FUNCTION get_group_members_batch(uuid[]) OWNER TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_group_members_batch(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_group_members_batch(uuid[]) FROM anon;

-- Add comment
COMMENT ON FUNCTION get_group_members_batch IS 'Fetches group members for multiple groups, bypassing RLS. Uses explicit table aliases to avoid column name ambiguity.';

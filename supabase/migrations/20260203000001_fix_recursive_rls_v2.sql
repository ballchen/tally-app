-- Fix recursive RLS policy - Version 2
-- This version ensures RLS is properly bypassed by using ALTER FUNCTION

-- Drop existing function if any
DROP FUNCTION IF EXISTS get_group_members_batch(uuid[]);

-- Create RPC function with explicit RLS bypass
CREATE FUNCTION get_group_members_batch(p_group_ids uuid[])
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
  -- This query should not trigger recursive RLS since we're checking user_id directly
  SELECT array_agg(DISTINCT group_id)
  INTO v_user_groups
  FROM group_members
  WHERE user_id = v_user_id
    AND group_id = ANY(p_group_ids);

  -- If user is not member of any requested groups, return empty
  IF v_user_groups IS NULL THEN
    RETURN;
  END IF;

  -- Now fetch all members for those groups
  -- This runs with SECURITY DEFINER privileges, bypassing RLS
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
  WHERE gm.group_id = ANY(v_user_groups);
END;
$$;

-- Set function owner to postgres to ensure it has BYPASSRLS
ALTER FUNCTION get_group_members_batch(uuid[]) OWNER TO postgres;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_group_members_batch(uuid[]) TO authenticated;

-- Revoke from anon to ensure only authenticated users can call it
REVOKE EXECUTE ON FUNCTION get_group_members_batch(uuid[]) FROM anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_group_members_batch IS 'Fetches group members for multiple groups, bypassing RLS to avoid stack depth recursion. Only returns members for groups where the caller is a member.';

-- Add archive and soft delete support for groups
-- Also adds personal hide feature for group members

-- Add archived_at and deleted_at to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add hidden_at to group_members table for personal hiding
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- Create index for faster queries on active groups
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_archived_at ON groups(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_members_hidden_at ON group_members(hidden_at) WHERE hidden_at IS NULL;

-- RPC: Archive a group (Owner only)
CREATE OR REPLACE FUNCTION archive_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_created_by uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is the owner
  SELECT created_by INTO v_created_by FROM groups WHERE id = p_group_id;
  IF v_created_by IS NULL OR v_created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the group owner can archive this group';
  END IF;

  UPDATE groups SET archived_at = NOW() WHERE id = p_group_id AND archived_at IS NULL;
END;
$$;

-- RPC: Unarchive a group (Owner only)
CREATE OR REPLACE FUNCTION unarchive_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_created_by uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is the owner
  SELECT created_by INTO v_created_by FROM groups WHERE id = p_group_id;
  IF v_created_by IS NULL OR v_created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the group owner can unarchive this group';
  END IF;

  UPDATE groups SET archived_at = NULL WHERE id = p_group_id AND archived_at IS NOT NULL;
END;
$$;

-- RPC: Soft delete a group (Owner only)
CREATE OR REPLACE FUNCTION delete_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_created_by uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is the owner
  SELECT created_by INTO v_created_by FROM groups WHERE id = p_group_id;
  IF v_created_by IS NULL OR v_created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the group owner can delete this group';
  END IF;

  UPDATE groups SET deleted_at = NOW() WHERE id = p_group_id AND deleted_at IS NULL;
END;
$$;

-- RPC: Restore a deleted group (Owner only) - for admin/recovery purposes
CREATE OR REPLACE FUNCTION restore_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_created_by uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is the owner
  SELECT created_by INTO v_created_by FROM groups WHERE id = p_group_id;
  IF v_created_by IS NULL OR v_created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the group owner can restore this group';
  END IF;

  UPDATE groups SET deleted_at = NULL WHERE id = p_group_id AND deleted_at IS NOT NULL;
END;
$$;

-- RPC: Hide a group for current user (Personal)
CREATE OR REPLACE FUNCTION hide_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE group_members
  SET hidden_at = NOW()
  WHERE group_id = p_group_id AND user_id = v_user_id AND hidden_at IS NULL;
END;
$$;

-- RPC: Unhide a group for current user (Personal)
CREATE OR REPLACE FUNCTION unhide_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE group_members
  SET hidden_at = NULL
  WHERE group_id = p_group_id AND user_id = v_user_id AND hidden_at IS NOT NULL;
END;
$$;

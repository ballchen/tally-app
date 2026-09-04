export type GroupMemberRow = {
  group_id: string
  user_id: string
  group_nickname: string | null
  group_avatar_url: string | null
  joined_at: string
  hidden_at: string | null
  profile_id: string
  profile_display_name: string | null
  profile_avatar_url: string | null
}

export type GroupMember = {
  group_id: string
  user_id: string
  group_nickname: string | null
  group_avatar_url: string | null
  joined_at: string
  hidden_at: string | null
  profiles: {
    id: string
    display_name: string | null
    avatar_url: string | null
  }
}

/** Flattens the get_group_members_batch RPC row into the nested shape the UI expects. */
export function mapMemberRow(m: GroupMemberRow): GroupMember {
  return {
    group_id: m.group_id,
    user_id: m.user_id,
    group_nickname: m.group_nickname,
    group_avatar_url: m.group_avatar_url,
    joined_at: m.joined_at,
    hidden_at: m.hidden_at,
    profiles: {
      id: m.profile_id,
      display_name: m.profile_display_name,
      avatar_url: m.profile_avatar_url,
    },
  }
}

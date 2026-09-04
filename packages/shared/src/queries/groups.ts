import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { mapMemberRow, type GroupMember, type GroupMemberRow } from "../members"
import { logActivity } from "../lib/activity-log"
import { safeGetUser } from "../lib/auth-helpers"
import { useSupabase } from "../supabase-context"
import type { GroupRow } from "./group-details"

export type { GroupRow } from "./group-details"

export type { GroupFilter } from "../lib/filter-user-groups"
import type { GroupFilter } from "../lib/filter-user-groups"

export type GroupListItem = GroupRow & {
  all_members: GroupMember[]
  group_members: { user_id: string; hidden_at: string | null }[]
}

export function useGroups(
  filter: GroupFilter = "active"
): UseQueryResult<GroupListItem[], Error> {
  const supabase = useSupabase()

  return useQuery<GroupListItem[], Error>({
    queryKey: ["groups", filter],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      let query = supabase.from("groups").select("*").is("deleted_at", null)

      if (filter === "active") {
        query = query.is("archived_at", null)
      } else if (filter === "archived") {
        query = query.not("archived_at", "is", null)
      }

      const { data: allGroups, error } = await query

      if (error) throw error
      if (!allGroups || allGroups.length === 0) return []

      const groupIds = (allGroups as GroupRow[]).map((g) => g.id)

      // RLS on group_members recurses; the RPC is security definer.
      const { data: membersData, error: membersError } = await supabase.rpc(
        "get_group_members_batch",
        { p_group_ids: groupIds }
      )

      if (membersError) throw membersError

      const allMembers = ((membersData ?? []) as GroupMemberRow[]).map(mapMemberRow)

      const userGroupIds = new Set(
        allMembers.filter((m) => m.user_id === user.id).map((m) => m.group_id)
      )

      const enrichedData: GroupListItem[] = (allGroups as GroupRow[])
        .filter((g) => userGroupIds.has(g.id))
        .map((group) => {
          const groupMembers = allMembers.filter((m) => m.group_id === group.id)

          return {
            ...group,
            all_members: groupMembers,
            group_members: [
              {
                user_id: user.id,
                hidden_at:
                  groupMembers.find((m) => m.user_id === user.id)?.hidden_at ?? null,
              },
            ],
          }
        })

      if (filter === "active") {
        return enrichedData.filter(
          (g) => !g.group_members.some((m) => m.user_id === user.id && m.hidden_at)
        )
      }
      if (filter === "hidden") {
        return enrichedData.filter((g) =>
          g.group_members.some((m) => m.user_id === user.id && m.hidden_at)
        )
      }

      return enrichedData
    },
  })
}

export type GroupBalance = { group_id: string; net_balance: number }

export function useMyGroupBalances(): UseQueryResult<
  Record<string, number>,
  Error
> {
  const supabase = useSupabase()

  return useQuery<Record<string, number>, Error>({
    queryKey: ["my-group-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_group_balances")
      if (error) throw error
      return Object.fromEntries(
        ((data ?? []) as GroupBalance[]).map((row) => [
          row.group_id,
          Number(row.net_balance),
        ])
      )
    },
  })
}

export function useCreateGroup(): UseMutationResult<
  GroupRow,
  Error,
  { name: string; baseCurrency: string }
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, baseCurrency }) => {
      const inviteCode = nanoid(8)

      const { data: groupId, error } = await supabase.rpc("create_group", {
        p_name: name,
        p_base_currency: baseCurrency,
        p_invite_code: inviteCode,
      })

      if (error) throw error

      const { data: group, error: fetchError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (fetchError) throw fetchError
      return group as GroupRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })
}

export type UpdateGroupParams = {
  groupId: string
  name?: string
  baseCurrency?: string
  coverImageUrl?: string | null
  regenerateInviteCode?: boolean
}

type OldGroup = { name: string; base_currency: string } | null

export function useUpdateGroup(): UseMutationResult<
  { data: GroupRow; oldGroup: OldGroup },
  Error,
  UpdateGroupParams
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
      baseCurrency,
      coverImageUrl,
      regenerateInviteCode,
    }) => {
      const { data: oldGroup } = await supabase
        .from("groups")
        .select("name, base_currency")
        .eq("id", groupId)
        .single()

      const updates: Record<string, string | null> = {}

      if (name !== undefined) updates.name = name
      if (baseCurrency !== undefined) updates.base_currency = baseCurrency
      if (coverImageUrl !== undefined) updates.cover_image_url = coverImageUrl
      if (regenerateInviteCode) updates.invite_code = nanoid(8)

      const { data, error } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", groupId)
        .select()
        .single()

      if (error) throw error
      return { data: data as GroupRow, oldGroup: oldGroup as OldGroup }
    },
    onSuccess: ({ oldGroup }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })

      const changes: Record<string, unknown> = {}
      if (oldGroup) {
        if (variables.name !== undefined && oldGroup.name !== variables.name)
          changes.name = { old: oldGroup.name, new: variables.name }
        if (
          variables.baseCurrency !== undefined &&
          oldGroup.base_currency !== variables.baseCurrency
        )
          changes.base_currency = {
            old: oldGroup.base_currency,
            new: variables.baseCurrency,
          }
      }

      logActivity(supabase, {
        groupId: variables.groupId,
        action: "group.update",
        entityType: "group",
        entityId: variables.groupId,
        changes,
      })
    },
  })
}

export function useUploadGroupCover(): UseMutationResult<
  string,
  Error,
  { groupId: string; file: File }
> {
  const supabase = useSupabase()

  return useMutation({
    mutationFn: async ({ groupId, file }) => {
      const fileExt = file.name.split(".").pop()
      const filePath = `${groupId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("group-covers")
        .upload(filePath, file, { cacheControl: "0", upsert: true })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("group-covers").getPublicUrl(filePath)

      // Cache-busting query keeps a replaced cover from showing the stale image.
      return `${publicUrl}?t=${Date.now()}`
    },
  })
}

export function useArchiveGroup(): UseMutationResult<
  void,
  Error,
  { groupId: string; archive: boolean }
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, archive }) => {
      const { error } = await supabase.rpc(
        archive ? "archive_group" : "unarchive_group",
        { p_group_id: groupId }
      )
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      logActivity(supabase, {
        groupId: variables.groupId,
        action: variables.archive ? "group.archive" : "group.unarchive",
        entityType: "group",
        entityId: variables.groupId,
      })
    },
  })
}

export function useDeleteGroup(): UseMutationResult<void, Error, string> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc("delete_group", { p_group_id: groupId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })
}

export function useHideGroup(): UseMutationResult<
  void,
  Error,
  { groupId: string; hide: boolean }
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, hide }) => {
      const { error } = await supabase.rpc(hide ? "hide_group" : "unhide_group", {
        p_group_id: groupId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })
}

export function useLeaveGroup(): UseMutationResult<void, Error, string> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc("leave_group", { p_group_id: groupId })
      if (error) throw error
    },
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
    },
  })
}

export function useRemoveMember(): UseMutationResult<
  void,
  Error,
  { groupId: string; userId: string }
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      const { error } = await supabase.rpc("remove_member", {
        p_group_id: groupId,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      logActivity(supabase, {
        groupId: variables.groupId,
        action: "member.remove",
        entityType: "member",
        entityId: variables.userId,
      })
    },
  })
}

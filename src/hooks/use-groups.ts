import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"

export type GroupFilter = "active" | "archived" | "hidden" | "all"

export function useGroups(filter: GroupFilter = "active") {
  const supabase = createClient()

  return useQuery({
    queryKey: ["groups", filter],
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    queryFn: async () => {
      // Safe auth with error handling
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      // Use RPC to get groups and members in one call (bypasses RLS recursion)
      // First, get ALL groups (we'll filter by membership via RPC)
      let query = supabase
        .from("groups")
        .select("*")
        .is("deleted_at", null)

      // Apply archive filter at query level for performance
      if (filter === "active") {
        query = query.is("archived_at", null)
      } else if (filter === "archived") {
        query = query.not("archived_at", "is", null)
      }

      const { data: allGroups, error } = await query

      if (error) throw error
      if (!allGroups || allGroups.length === 0) return []

      // Get all group IDs
      const groupIds = allGroups.map(g => g.id)

      // Fetch members using RPC (bypasses RLS recursion)
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_group_members_batch', { p_group_ids: groupIds })

      if (membersError) throw membersError

      // Transform RPC response to match expected format
      const allMembers = membersData?.map(m => ({
        group_id: m.group_id,
        user_id: m.user_id,
        group_nickname: m.group_nickname,
        group_avatar_url: m.group_avatar_url,
        joined_at: m.joined_at,
        hidden_at: m.hidden_at,
        profiles: {
          id: m.profile_id,
          display_name: m.profile_display_name,
          avatar_url: m.profile_avatar_url
        }
      })) || []

      // Filter to only groups where user is a member
      const userGroupIds = new Set(
        allMembers
          .filter(m => m.user_id === user.id)
          .map(m => m.group_id)
      )

      const userGroups = allGroups.filter(g => userGroupIds.has(g.id))

      // Attach members and member info to each group
      const enrichedData = userGroups.map(group => {
        const groupMembers = allMembers.filter(m => m.group_id === group.id)

        return {
          ...group,
          all_members: groupMembers,
          group_members: [{
            user_id: user.id,
            hidden_at: groupMembers.find(m => m.user_id === user.id)?.hidden_at
          }]
        }
      })

      // Apply hidden filter in JS
      if (filter === "active") {
        return enrichedData.filter(g =>
          !g.group_members.some((m: any) => m.user_id === user.id && m.hidden_at)
        )
      } else if (filter === "hidden") {
        return enrichedData.filter(g =>
          g.group_members.some((m: any) => m.user_id === user.id && m.hidden_at)
        )
      }

      return enrichedData
    }
  })
}

export function useCreateGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, baseCurrency }: { name: string; baseCurrency: string }) => {
      const inviteCode = nanoid(8)

      // Use RPC to create group (bypasses RLS with security definer)
      const { data: groupId, error } = await supabase.rpc('create_group', {
        p_name: name,
        p_base_currency: baseCurrency,
        p_invite_code: inviteCode
      })

      if (error) throw error

      // Fetch the created group to return it
      const { data: group, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (fetchError) throw fetchError
      return group
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    }
  })
}

export function useUpdateGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
      baseCurrency,
      coverImageUrl,
      regenerateInviteCode
    }: {
      groupId: string
      name?: string
      baseCurrency?: string
      coverImageUrl?: string | null
      regenerateInviteCode?: boolean
    }) => {
      const updates: Record<string, string | null> = {}

      if (name !== undefined) updates.name = name
      if (baseCurrency !== undefined) updates.base_currency = baseCurrency
      if (coverImageUrl !== undefined) updates.cover_image_url = coverImageUrl
      if (regenerateInviteCode) updates.invite_code = nanoid(8)

      const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
    }
  })
}

export function useUploadGroupCover() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ groupId, file }: { groupId: string; file: File }) => {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${groupId}/${fileName}`

      // Upload with upsert to replace existing files
      const { error: uploadError } = await supabase.storage
        .from('group-covers')
        .upload(filePath, file, {
          cacheControl: '0',
          upsert: true
        })

      if (uploadError) {
        console.error('Group cover upload error:', uploadError)
        throw uploadError
      }

      // Get public URL with cache busting parameter
      const { data: { publicUrl } } = supabase.storage
        .from('group-covers')
        .getPublicUrl(filePath)

      // Add timestamp to prevent caching issues
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      
      console.log('Group cover upload successful:', urlWithCacheBust)
      return urlWithCacheBust
    }
  })
}

export function useArchiveGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, archive }: { groupId: string; archive: boolean }) => {
      const { error } = await supabase.rpc(
        archive ? 'archive_group' : 'unarchive_group',
        { p_group_id: groupId }
      )
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
    }
  })
}

export function useDeleteGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('delete_group', { p_group_id: groupId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    }
  })
}

export function useHideGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, hide }: { groupId: string; hide: boolean }) => {
      const { error } = await supabase.rpc(
        hide ? 'hide_group' : 'unhide_group',
        { p_group_id: groupId }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    }
  })
}

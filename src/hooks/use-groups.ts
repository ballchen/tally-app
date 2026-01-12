import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"

export type GroupFilter = "active" | "archived" | "hidden" | "all"

export function useGroups(filter: GroupFilter = "active") {
  const supabase = createClient()

  return useQuery({
    queryKey: ["groups", filter],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      let query = supabase
        .from("groups")
        .select(`
          *,
          group_members!inner(user_id, hidden_at)
        `)
        .is("deleted_at", null) // Always exclude deleted groups
        .eq("group_members.user_id", user.id)

      // Apply filter
      if (filter === "active") {
        query = query.is("archived_at", null)
        // Filter out hidden groups in JS since we need the join
      } else if (filter === "archived") {
        query = query.not("archived_at", "is", null)
      }
      // "hidden" and "all" will be filtered in JS

      const { data, error } = await query

      if (error) throw error

      // Apply hidden filter in JS
      if (filter === "active") {
        return data?.filter(g =>
          !g.group_members?.some((m: any) => m.user_id === user.id && m.hidden_at)
        ) || []
      } else if (filter === "hidden") {
        return data?.filter(g =>
          g.group_members?.some((m: any) => m.user_id === user.id && m.hidden_at)
        ) || []
      }

      return data || []
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

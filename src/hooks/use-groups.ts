import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"

export function useGroups() {
  const supabase = createClient()

  return useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`
          *,
          group_members!inner(user_id)
        `)

      if (error) throw error
      return data
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

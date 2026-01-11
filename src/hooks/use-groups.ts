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
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name,
          base_currency: baseCurrency,
          invite_code: inviteCode
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Automatically add creator as member
      const { data: user } = await supabase.auth.getUser()
      if (user.user) {
        const { error: memberError } = await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: user.user.id
          })

        if (memberError) throw memberError
      }

      return group
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    }
  })
}

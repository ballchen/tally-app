import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"

export function useGroupDetails(groupId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      // 1. Fetch Group Info
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (groupError) throw groupError

      // 2. Fetch Members
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("group_id", groupId)

      if (membersError) throw membersError

      // 3. Fetch Expenses
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select(`
          *,
          payer:payer_id (
            display_name,
            avatar_url
          ),
          expense_splits (
            user_id,
            profiles:user_id (
               display_name,
               avatar_url
            )
          )
        `)
        .eq("group_id", groupId)
        .order("date", { ascending: false })

      if (expensesError) throw expensesError

      return {
        group,
        members,
        expenses
      }
    },
    enabled: !!groupId
  })
}

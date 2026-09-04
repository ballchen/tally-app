import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { useQuery } from "@tanstack/react-query"
import { mapMemberRow, type GroupMemberRow } from "@/lib/members"

export function useGroupDetails(groupId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      // Verify authentication
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      // 1. Fetch Group Info
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (groupError) throw groupError

      // 2. Fetch Members using RPC (bypasses RLS restrictions)
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_group_members_batch', { p_group_ids: [groupId] })

      if (membersError) throw membersError

      const members = ((membersData ?? []) as GroupMemberRow[]).map(mapMemberRow)

      // 3. Fetch Expenses (exclude soft-deleted)
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select(`
          *,
          payer:payer_id (
            display_name,
            avatar_url
          ),

          type,

          expense_splits (
            user_id,
            owed_amount,
            owed_amount_base,
            settlement_id,
            profiles:user_id (
               display_name,
               avatar_url
            )
          )
        `)
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("date", { ascending: false })

      if (expensesError) throw expensesError

      // 4. Fetch Settlements
      const { data: settlements, error: settlementsError } = await supabase
        .from("settlements")
        .select(`
            *,
            creator:created_by (
                display_name,
                avatar_url
            )
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })

      if (settlementsError) throw settlementsError

      return {
        group,
        members,
        expenses,
        settlements
      }
    },
    enabled: !!groupId
  })
}

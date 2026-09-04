import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { useQuery } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapMemberRow, type GroupMemberRow } from "@tally/shared/members"

export async function fetchGroupDetails(
  supabase: SupabaseClient,
  groupId: string
) {
  const { user, error: authError } = await safeGetUser(supabase)
  if (authError) throw authError
  if (!user) throw new Error("Not authenticated")

  const [groupResult, membersResult, expensesResult, settlementsResult] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.rpc("get_group_members_batch", { p_group_ids: [groupId] }),
      supabase
        .from("expenses")
        .select(
          `
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
        `
        )
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("date", { ascending: false }),
      supabase
        .from("settlements")
        .select(
          `
            *,
            creator:created_by (
                display_name,
                avatar_url
            )
        `
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ])

  if (groupResult.error) throw groupResult.error
  if (membersResult.error) throw membersResult.error
  if (expensesResult.error) throw expensesResult.error
  if (settlementsResult.error) throw settlementsResult.error

  return {
    group: groupResult.data,
    members: ((membersResult.data ?? []) as GroupMemberRow[]).map(mapMemberRow),
    expenses: expensesResult.data,
    settlements: settlementsResult.data,
  }
}

export function useGroupDetails(groupId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroupDetails(supabase, groupId),
    enabled: !!groupId,
  })
}

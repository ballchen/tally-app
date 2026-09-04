import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapMemberRow, type GroupMember, type GroupMemberRow } from "../members"
import { safeGetUser } from "../lib/auth-helpers"
import { useSupabase } from "../supabase-context"

export type GroupRow = {
  id: string
  name: string
  base_currency: string
  invite_code: string
  created_by: string | null
  cover_image_url: string | null
  archived_at: string | null
  deleted_at: string | null
  [key: string]: unknown
}

export type GroupExpenseSplit = {
  user_id: string
  owed_amount: number
  owed_amount_base: number | null
  settlement_id: string | null
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export type GroupExpense = {
  id: string
  group_id: string
  payer_id: string
  amount: number
  currency: string
  description: string | null
  exchange_rate: number | null
  date: string
  type: string | null
  settlement_id: string | null
  deleted_at: string | null
  created_by: string | null
  payer: { display_name: string | null; avatar_url: string | null } | null
  expense_splits: GroupExpenseSplit[] | null
  [key: string]: unknown
}

export type GroupSettlement = {
  id: string
  group_id: string
  created_by: string | null
  created_at: string
  creator: { display_name: string | null; avatar_url: string | null } | null
  [key: string]: unknown
}

export type GroupDetails = {
  group: GroupRow
  members: GroupMember[]
  expenses: GroupExpense[]
  settlements: GroupSettlement[]
}

export async function fetchGroupDetails(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupDetails> {
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
    group: groupResult.data as GroupRow,
    members: ((membersResult.data ?? []) as GroupMemberRow[]).map(mapMemberRow),
    expenses: (expensesResult.data ?? []) as GroupExpense[],
    settlements: (settlementsResult.data ?? []) as GroupSettlement[],
  }
}

export function useGroupDetails(
  groupId: string
): UseQueryResult<GroupDetails, Error> {
  const supabase = useSupabase()

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroupDetails(supabase, groupId),
    enabled: !!groupId,
  })
}

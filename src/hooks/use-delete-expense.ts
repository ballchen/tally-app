import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { logActivity } from "@/lib/activity-log"
import type { GroupDetailsCache } from "@/lib/group-query-cache"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expenseId,
      groupId,
      description,
      amount,
      currency,
    }: {
      expenseId: string
      groupId: string
      description?: string
      amount?: number
      currency?: string
    }) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) {
        throw new Error("User not authenticated. Please login again.")
      }

      const { data, error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        console.warn("No rows updated. Possible RLS policy blocking update.")
      }

      return { groupId, expenseId, description, amount, currency }
    },
    onMutate: async ({ expenseId, groupId }) => {
      const queryKey = ["group", groupId] as const
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<GroupDetailsCache>(queryKey)

      if (previous) {
        queryClient.setQueryData<GroupDetailsCache>(queryKey, {
          ...previous,
          expenses: previous.expenses.filter((e) => e.id !== expenseId),
        })
      }

      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      logActivity(supabase, {
        groupId: data.groupId,
        action: "expense.delete",
        entityType: "expense",
        entityId: data.expenseId,
        changes: {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
        },
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense"] })
    },
  })
}

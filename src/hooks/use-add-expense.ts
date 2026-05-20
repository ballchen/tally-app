import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { logActivity } from "@/lib/activity-log"
import {
  buildOptimisticExpense,
  type GroupDetailsCache,
} from "@/lib/group-query-cache"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export type CreateExpenseParams = {
  groupId: string
  payerId: string
  amount: number
  currency: string
  description: string
  exchangeRate: number
  split: {
    userId: string
    amount: number
  }[]
}

export function useAddExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      payerId,
      amount,
      currency,
      description,
      exchangeRate,
      split,
    }: CreateExpenseParams) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: groupId,
          payer_id: payerId,
          amount,
          currency,
          description,
          exchange_rate: exchangeRate,
          created_by: user.id,
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      const splitsData = split.map((s) => ({
        expense_id: expense.id,
        user_id: s.userId,
        owed_amount: s.amount,
        owed_amount_base: s.amount * exchangeRate,
      }))

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splitsData)

      if (splitError) throw splitError

      return expense
    },
    onMutate: async (variables) => {
      const queryKey = ["group", variables.groupId] as const
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<GroupDetailsCache>(queryKey)
      const { user } = await safeGetUser(supabase)

      if (previous && user) {
        const tempId = `optimistic-${crypto.randomUUID()}`
        const optimisticExpense = buildOptimisticExpense(
          variables,
          user,
          previous.members,
          tempId
        )

        queryClient.setQueryData<GroupDetailsCache>(queryKey, {
          ...previous,
          expenses: [optimisticExpense, ...previous.expenses],
        })
      }

      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },
    onSuccess: (data, variables) => {
      logActivity(supabase, {
        groupId: variables.groupId,
        action: "expense.create",
        entityType: "expense",
        entityId: data.id,
        changes: {
          description: variables.description,
          amount: variables.amount,
          currency: variables.currency,
        },
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
    },
  })
}

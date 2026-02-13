import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export type CreateExpenseParams = {
  groupId: string
  payerId: string
  amount: number
  currency: string
  description: string
  split: {
    userId: string
    amount: number // Simplified for now: Assume frontend calculates amounts
  }[]
}

export function useAddExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, payerId, amount, currency, description, split }: CreateExpenseParams) => {
      // Get current user ID with safe error handling
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      // 1. Create Expense
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: groupId,
          payer_id: payerId,
          amount,
          currency,
          description,
          created_by: user.id
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      // 2. Create Splits
      const splitsData = split.map(s => ({
        expense_id: expense.id,
        user_id: s.userId,
        owed_amount: s.amount
      }))

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splitsData)

      if (splitError) throw splitError

      return expense
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
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
    }
  })
}

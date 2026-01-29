import { createClient } from "@/lib/supabase/client"
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
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser()
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
    }
  })
}

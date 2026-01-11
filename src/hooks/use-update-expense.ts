import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export type UpdateExpenseParams = {
  expenseId: string
  groupId: string
  payerId: string
  amount: number
  currency: string
  description: string
  split: {
    userId: string
    amount: number
  }[]
}

export function useUpdateExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ expenseId, groupId, payerId, amount, currency, description, split }: UpdateExpenseParams) => {
      // Use RPC for atomic update
      const { error } = await supabase.rpc("update_expense_details", {
        p_expense_id: expenseId,
        p_payer_id: payerId,
        p_amount: amount,
        p_currency: currency,
        p_description: description,
        p_splits: split.map(s => ({ user_id: s.userId, amount: s.amount }))
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] })
    }
  })
}

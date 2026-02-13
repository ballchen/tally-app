import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
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
      // Fetch old values for diff logging
      const { data: oldExpense } = await supabase
        .from("expenses")
        .select("amount, currency, description, payer_id")
        .eq("id", expenseId)
        .single()

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

      return { oldExpense }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] })

      const changes: Record<string, unknown> = {}
      const old = data.oldExpense
      if (old) {
        if (old.description !== variables.description) changes.description = { old: old.description, new: variables.description }
        if (Number(old.amount) !== variables.amount) changes.amount = { old: old.amount, new: variables.amount }
        if (old.currency !== variables.currency) changes.currency = { old: old.currency, new: variables.currency }
        if (old.payer_id !== variables.payerId) changes.payer = { old: old.payer_id, new: variables.payerId }
      }

      logActivity(supabase, {
        groupId: variables.groupId,
        action: "expense.update",
        entityType: "expense",
        entityId: variables.expenseId,
        changes,
      })
    }
  })
}

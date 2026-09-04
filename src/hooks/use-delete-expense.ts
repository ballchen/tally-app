import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ expenseId, groupId, description, amount, currency }: { expenseId: string; groupId: string; description?: string; amount?: number; currency?: string }) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error('User not authenticated. Please login again.')

      // Soft delete: set deleted_at timestamp instead of actually deleting
      const { data, error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId)
        .select()

      if (error) throw error
      if (!data || data.length === 0) throw new Error('Expense not found or not permitted')

      return { groupId, expenseId, description, amount, currency }
    },
    onSuccess: (data) => {
      // Invalidate the specific group query to refresh expenses list
      queryClient.invalidateQueries({ queryKey: ["group", data.groupId] })
      // Also invalidate the expense query if it exists
      queryClient.invalidateQueries({ queryKey: ["expense"] })
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
    }
  })
}

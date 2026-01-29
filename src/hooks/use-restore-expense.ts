import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useRestoreExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ expenseId, groupId }: { expenseId: string; groupId: string }) => {
      // Restore by setting deleted_at back to null
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", expenseId)

      if (error) throw error

      return { groupId }
    },
    onSuccess: (data) => {
      // Invalidate the specific group query to refresh expenses list
      queryClient.invalidateQueries({ queryKey: ["group", data.groupId] })
      // Also invalidate the expense query if it exists
      queryClient.invalidateQueries({ queryKey: ["expense"] })
    }
  })
}

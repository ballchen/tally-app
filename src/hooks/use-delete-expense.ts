import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate all group queries to refresh expenses list
      queryClient.invalidateQueries({ queryKey: ["group"] })
    }
  })
}

import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"

export function useExpense(expenseId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["expense", expenseId],
    queryFn: async () => {
      if (!expenseId) return null

      // 1. Fetch Expense (exclude soft-deleted)
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select(`
            *,
            payer:payer_id (
                id,
                display_name,
                avatar_url
            )
        `)
        .eq("id", expenseId)
        .is("deleted_at", null)
        .single()

      if (expenseError) throw expenseError

      // 2. Fetch Splits
      const { data: splits, error: splitsError } = await supabase
        .from("expense_splits")
        .select("*")
        .eq("expense_id", expenseId)

      if (splitsError) throw splitsError

      return {
        ...expense,
        splits
      }
    },
    enabled: !!expenseId
  })
}

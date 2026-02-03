import { createClient } from "@/lib/supabase/client"
import { safeGetUser } from "@/lib/supabase/auth-helpers"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ expenseId, groupId }: { expenseId: string; groupId: string }) => {
      // Debug: Check auth status first with safe error handling
      const { user, error: authError } = await safeGetUser(supabase)
      console.log('🔐 Auth check before delete:')
      console.log('  User ID:', user?.id || 'NOT LOGGED IN')
      console.log('  User email:', user?.email)
      console.log('  Auth error:', authError)

      if (authError) throw authError
      if (!user) {
        throw new Error('User not authenticated. Please login again.')
      }

      // Soft delete: set deleted_at timestamp instead of actually deleting
      const { data, error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId)
        .select()

      if (error) {
        console.error('❌ Delete expense error:', error)
        console.error('  Error code:', error.code)
        console.error('  Error message:', error.message)
        console.error('  Expense ID:', expenseId)
        console.error('  Group ID:', groupId)
        throw error
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No rows updated. Possible RLS policy blocking update.')
        console.log('Expense ID:', expenseId)
        console.log('Group ID:', groupId)
      } else {
        console.log('✅ Soft delete successful:', data)
      }

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

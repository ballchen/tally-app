import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export function useUndoSettlement() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (settlementId: string) => {
      const { error } = await supabase.rpc("undo_settlement", {
        p_settlement_id: settlementId
      })

      if (error) throw error
    },
    onSuccess: (_, settlementId) => {
      toast.success("Settlement undone")
      queryClient.invalidateQueries({ queryKey: ["group"] })
    },
    onError: (error: any) => {
      toast.error("Failed to undo settlement", {
        description: error.message
      })
    }
  })
}

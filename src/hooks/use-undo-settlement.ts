import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export function useUndoSettlement() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ settlementId, groupId }: { settlementId: string; groupId: string }) => {
      const { error } = await supabase.rpc("undo_settlement", {
        p_settlement_id: settlementId
      })

      if (error) throw error
      return { settlementId, groupId }
    },
    onSuccess: (data) => {
      toast.success("Settlement undone")
      queryClient.invalidateQueries({ queryKey: ["group"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      logActivity(supabase, {
        groupId: data.groupId,
        action: "settlement.undo",
        entityType: "settlement",
        entityId: data.settlementId,
      })
    },
    onError: (error: any) => {
      toast.error("Failed to undo settlement", {
        description: error.message
      })
    }
  })
}

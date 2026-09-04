import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

export function useUndoSettlement() {
  const queryClient = useQueryClient()
  const t = useTranslations("SettleUp")
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
      toast.success(t("settlementUndone"))
      queryClient.invalidateQueries({ queryKey: ["group", data.groupId] })
      logActivity(supabase, {
        groupId: data.groupId,
        action: "settlement.undo",
        entityType: "settlement",
        entityId: data.settlementId,
      })
    },
    onError: (error: Error) => {
      toast.error(t("undoFailed"), {
        description: error.message
      })
    }
  })
}

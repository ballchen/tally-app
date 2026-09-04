import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useUndoSettlement as useSharedUndoSettlement } from "@tally/shared/queries/settlements"
import { withMutationCallbacks } from "@/lib/wrap-mutation"

export function useUndoSettlement() {
  const t = useTranslations("SettleUp")
  const undoSettlement = useSharedUndoSettlement()

  return withMutationCallbacks(undoSettlement, {
    onSuccess: () => {
      toast.success(t("settlementUndone"))
    },
    onError: (error) => {
      toast.error(t("undoFailed"), { description: error.message })
    },
  })
}

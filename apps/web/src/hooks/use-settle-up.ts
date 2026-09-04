import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useSettleUp as useSharedSettleUp } from "@tally/shared/queries/settlements"
import { withMutationCallbacks } from "@/lib/wrap-mutation"

export function useSettleUp() {
  const t = useTranslations("SettleUp")
  const settleUp = useSharedSettleUp()

  return withMutationCallbacks(settleUp, {
    onSuccess: () => {
      toast.success(t("allSettled"))
    },
    onError: (error) => {
      toast.error(t("settlementFailed"), { description: error.message })
    },
  })
}

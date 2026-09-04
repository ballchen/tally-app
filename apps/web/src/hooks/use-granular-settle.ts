import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { formatAmount } from "@tally/shared/currency"
import { sendPush } from "@tally/shared/lib/push"
import { useGranularSettle as useSharedGranularSettle } from "@tally/shared/queries/settlements"
import { useSupabase } from "@tally/shared/supabase-context"
import { withMutationCallbacks } from "@/lib/wrap-mutation"

export function useGranularSettle() {
  const t = useTranslations("SettleUp")
  const supabase = useSupabase()
  const granularSettle = useSharedGranularSettle()

  return withMutationCallbacks(granularSettle, {
    onSuccess: (_data, variables) => {
      toast.success(t("settlementRecorded"))

      sendPush(supabase, {
        userIds: [variables.creditorId],
        groupId: variables.groupId,
        title: t("pushTitle"),
        body: t("pushBody", {
          name: variables.debtorName || t("someone"),
          amount: formatAmount(variables.amount, variables.currency),
        }),
        url: `/groups/${variables.groupId}`,
      })
    },
    onError: (error) => {
      toast.error(t("settlementFailed"), { description: error.message })
    },
  })
}

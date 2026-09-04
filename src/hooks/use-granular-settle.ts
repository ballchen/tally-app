import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { formatAmount } from "@/lib/currency"

type GranularSettleParams = {
  groupId: string
  debtorId: string
  creditorId: string
  amount: number
  currency: string
  debtorName?: string
  creditorName?: string
}

export function useGranularSettle() {
  const queryClient = useQueryClient()
  const t = useTranslations("SettleUp")
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ groupId, debtorId, creditorId, amount, currency }: GranularSettleParams) => {
      const { data, error } = await supabase.rpc("settle_debt_rpc", {
        p_group_id: groupId,
        p_debtor_id: debtorId,
        p_creditor_id: creditorId,
        p_amount: amount,
        p_currency: currency
      })

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      toast.success(t("settlementRecorded"))
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })

      logActivity(supabase, {
        groupId: variables.groupId,
        action: "settlement.create",
        entityType: "settlement",
        changes: {
          type: "granular",
          repayments: [{
            from_name: variables.debtorName,
            to_name: variables.creditorName,
            amount: variables.amount,
            currency: variables.currency,
          }],
        },
      })

      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: [variables.creditorId],
          groupId: variables.groupId,
          title: t("pushTitle"),
          body: t("pushBody", {
            name: variables.debtorName || t("someone"),
            amount: formatAmount(variables.amount, variables.currency),
          }),
          url: `/groups/${variables.groupId}`
        })
      }).catch(err => console.error("Push notification failed", err))
    },
    onError: (error: Error) => {
      toast.error(t("settlementFailed"), {
        description: error.message
      })
    }
  })
}

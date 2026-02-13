import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
    onSuccess: async (_, variables) => {
      toast.success("Settlement recorded!")
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })

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

      // Send push notification to the creditor
      try {
        // Get debtor's name for notification
        const { data: debtorProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", variables.debtorId)
          .single()
        
        const debtorName = debtorProfile?.display_name || "Someone"
        
        // Send notification to creditor
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: [variables.creditorId],
            title: "Payment Received",
            body: `${debtorName} settled ${variables.currency} ${variables.amount.toFixed(2)} with you`,
            url: `/groups/${variables.groupId}`
          })
        }).catch(err => console.error("Push notification failed", err))
      } catch (error) {
        console.error("Failed to send settlement notification", error)
      }
    },
    onError: (error: Error) => {
      toast.error("Settlement failed", {
        description: error.message
      })
    }
  })
}

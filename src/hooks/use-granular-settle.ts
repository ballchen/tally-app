import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

type GranularSettleParams = {
  groupId: string
  debtorId: string
  creditorId: string
  amount: number
  currency: string
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
    onSuccess: (_, variables) => {
      toast.success("Settlement recorded!")
      queryClient.invalidateQueries({ queryKey: ["group-details", variables.groupId] })
    },
    onError: (error: any) => {
      toast.error("Settlement failed", {
        description: error.message
      })
    }
  })
}

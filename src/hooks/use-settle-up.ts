import { createClient } from "@/lib/supabase/client"
import { logActivity } from "@/lib/activity-log"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

type SettleUpParams = {
  groupId: string
  repayments: {
    from: string
    to: string
    amount: number
  }[]
  repaymentNames?: { fromName: string; toName: string; amount: number }[]
}

export function useSettleUp() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, repayments }: SettleUpParams) => {
      const { error } = await supabase.rpc("settle_group_expenses", {
        p_group_id: groupId,
        p_repayments: repayments
      })

      if (error) throw error
    },
    onSuccess: (_, { groupId, repaymentNames }) => {
      toast.success("All balances settled!")
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      logActivity(supabase, {
        groupId,
        action: "settlement.create",
        entityType: "settlement",
        changes: {
          type: "all",
          repayments: repaymentNames ?? [],
        },
      })
    },
    onError: (error: Error) => {
      toast.error("Settlement failed", {
        description: error.message
      })
    }
  })
}

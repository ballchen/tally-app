import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"

type SettleUpParams = {
  groupId: string
  repayments: {
    from: string
    to: string
    amount: number
  }[]
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
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
    }
  })
}

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query"
import { logActivity } from "../lib/activity-log"
import { useSupabase } from "../supabase-context"

export type RepaymentName = {
  fromName: string
  toName: string
  amount: number
  currency: string
}

export type SettleUpParams = {
  groupId: string
  repayments: { from: string; to: string; amount: number }[]
  repaymentNames?: RepaymentName[]
}

/** Resolves to the new settlement id so callers can offer undo. */
export function useSettleUp(): UseMutationResult<string, Error, SettleUpParams> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, repayments }: SettleUpParams) => {
      const { data, error } = await supabase.rpc("settle_group_expenses", {
        p_group_id: groupId,
        p_repayments: repayments,
      })

      if (error) throw error
      return data as string
    },
    onSuccess: (_, { groupId, repaymentNames }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
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
  })
}

export type GranularSettleParams = {
  groupId: string
  debtorId: string
  creditorId: string
  amount: number
  currency: string
  debtorName?: string
  creditorName?: string
}

export function useGranularSettle(): UseMutationResult<
  unknown,
  Error,
  GranularSettleParams
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      debtorId,
      creditorId,
      amount,
      currency,
    }: GranularSettleParams) => {
      const { data, error } = await supabase.rpc("settle_debt_rpc", {
        p_group_id: groupId,
        p_debtor_id: debtorId,
        p_creditor_id: creditorId,
        p_amount: amount,
        p_currency: currency,
      })

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })

      logActivity(supabase, {
        groupId: variables.groupId,
        action: "settlement.create",
        entityType: "settlement",
        changes: {
          type: "granular",
          repayments: [
            {
              from_name: variables.debtorName,
              to_name: variables.creditorName,
              amount: variables.amount,
              currency: variables.currency,
            },
          ],
        },
      })
    },
  })
}

export type UndoSettlementParams = { settlementId: string; groupId: string }

export function useUndoSettlement(): UseMutationResult<
  UndoSettlementParams,
  Error,
  UndoSettlementParams
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ settlementId, groupId }: UndoSettlementParams) => {
      const { error } = await supabase.rpc("undo_settlement", {
        p_settlement_id: settlementId,
      })

      if (error) throw error
      return { settlementId, groupId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group", data.groupId] })
      logActivity(supabase, {
        groupId: data.groupId,
        action: "settlement.undo",
        entityType: "settlement",
        entityId: data.settlementId,
      })
    },
  })
}

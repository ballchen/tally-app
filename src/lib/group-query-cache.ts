import type { CreateExpenseParams } from "@/hooks/use-add-expense"

export type GroupDetailsCache = {
  group: Record<string, unknown>
  members: Array<{
    group_id: string
    user_id: string
    group_nickname: string | null
    group_avatar_url: string | null
    joined_at: string
    hidden_at: string | null
    profiles: {
      id: string
      display_name: string | null
      avatar_url: string | null
    }
  }>
  expenses: Array<Record<string, unknown>>
  settlements: Array<Record<string, unknown>>
}

type MemberProfile = {
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export function buildOptimisticExpense(
  variables: CreateExpenseParams,
  user: { id: string; email?: string },
  members: MemberProfile[],
  tempId: string
) {
  const payerMember = members.find((m) => m.user_id === variables.payerId)
  const payerProfile = payerMember?.profiles ?? {
    display_name: user.email?.split("@")[0] ?? "You",
    avatar_url: null,
  }

  return {
    id: tempId,
    group_id: variables.groupId,
    payer_id: variables.payerId,
    amount: variables.amount,
    currency: variables.currency,
    description: variables.description,
    exchange_rate: variables.exchangeRate,
    created_by: user.id,
    date: new Date().toISOString(),
    type: "expense",
    deleted_at: null,
    payer: payerProfile,
    expense_splits: variables.split.map((s) => {
      const member = members.find((m) => m.user_id === s.userId)
      return {
        user_id: s.userId,
        owed_amount: s.amount,
        owed_amount_base: s.amount * variables.exchangeRate,
        settlement_id: null,
        profiles: member?.profiles ?? {
          display_name: null,
          avatar_url: null,
        },
      }
    }),
    _optimistic: true,
  }
}

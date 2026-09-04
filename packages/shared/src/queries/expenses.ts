import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { logActivity } from "../lib/activity-log"
import { safeGetUser } from "../lib/auth-helpers"
import {
  buildOptimisticExpense,
  type CreateExpenseParams,
  type GroupDetailsCache,
} from "../lib/group-query-cache"
import { useSupabase } from "../supabase-context"

export type { CreateExpenseParams } from "../lib/group-query-cache"

export type ExpenseRow = {
  id: string
  group_id: string
  payer_id: string
  amount: number
  currency: string
  description: string | null
  exchange_rate: number | null
  date: string
  type: string | null
  settlement_id: string | null
  deleted_at: string | null
  created_by: string | null
  [key: string]: unknown
}

export type ExpenseSplitRow = {
  id: string
  expense_id: string
  user_id: string
  owed_amount: number
  owed_amount_base: number | null
  settlement_id: string | null
  [key: string]: unknown
}

export type ExpenseWithSplits = ExpenseRow & {
  payer: { id: string; display_name: string | null; avatar_url: string | null } | null
  splits: ExpenseSplitRow[]
}

export function useExpense(
  expenseId: string | null
): UseQueryResult<ExpenseWithSplits | null, Error> {
  const supabase = useSupabase()

  return useQuery<ExpenseWithSplits | null, Error>({
    queryKey: ["expense", expenseId],
    queryFn: async () => {
      if (!expenseId) return null

      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select(
          `
            *,
            payer:payer_id (
                id,
                display_name,
                avatar_url
            )
        `
        )
        .eq("id", expenseId)
        .is("deleted_at", null)
        .single()

      if (expenseError) throw expenseError

      const { data: splits, error: splitsError } = await supabase
        .from("expense_splits")
        .select("*")
        .eq("expense_id", expenseId)

      if (splitsError) throw splitsError

      return {
        ...(expense as ExpenseWithSplits),
        splits: (splits ?? []) as ExpenseSplitRow[],
      }
    },
    enabled: !!expenseId,
  })
}

type OptimisticContext = {
  previous: GroupDetailsCache | undefined
  queryKey: QueryKey
}

export function useAddExpense(): UseMutationResult<
  ExpenseRow,
  Error,
  CreateExpenseParams,
  OptimisticContext
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation<ExpenseRow, Error, CreateExpenseParams, OptimisticContext>({
    mutationFn: async ({
      groupId,
      payerId,
      amount,
      currency,
      description,
      exchangeRate,
      split,
    }) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("Not authenticated")

      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: groupId,
          payer_id: payerId,
          amount,
          currency,
          description,
          exchange_rate: exchangeRate,
          created_by: user.id,
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      const splitsData = split.map((s) => ({
        expense_id: expense.id,
        user_id: s.userId,
        owed_amount: s.amount,
        owed_amount_base: s.amount * exchangeRate,
      }))

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splitsData)

      if (splitError) throw splitError

      return expense as ExpenseRow
    },
    onMutate: async (variables) => {
      const queryKey: QueryKey = ["group", variables.groupId]
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<GroupDetailsCache>(queryKey)
      const { user } = await safeGetUser(supabase)

      if (previous && user) {
        const tempId = `optimistic-${crypto.randomUUID()}`
        const optimisticExpense = buildOptimisticExpense(
          variables,
          user,
          previous.members,
          tempId
        )

        queryClient.setQueryData<GroupDetailsCache>(queryKey, {
          ...previous,
          expenses: [optimisticExpense, ...previous.expenses],
        })
      }

      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },
    onSuccess: (data, variables) => {
      logActivity(supabase, {
        groupId: variables.groupId,
        action: "expense.create",
        entityType: "expense",
        entityId: data.id,
        changes: {
          description: variables.description,
          amount: variables.amount,
          currency: variables.currency,
        },
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
    },
  })
}

export type UpdateExpenseParams = {
  expenseId: string
  groupId: string
  payerId: string
  payerName: string
  amount: number
  currency: string
  description: string
  exchangeRate: number
  split: {
    userId: string
    amount: number
  }[]
}

type OldExpense = {
  amount: number
  currency: string
  description: string
  payer_id: string
  payer: { display_name: string | null } | null
} | null

export function useUpdateExpense(): UseMutationResult<
  { oldExpense: OldExpense },
  Error,
  UpdateExpenseParams
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expenseId,
      payerId,
      amount,
      currency,
      description,
      exchangeRate,
      split,
    }: UpdateExpenseParams) => {
      const { data: oldExpense } = await supabase
        .from("expenses")
        .select("amount, currency, description, payer_id, payer:payer_id(display_name)")
        .eq("id", expenseId)
        .single()

      const { error } = await supabase.rpc("update_expense_details", {
        p_expense_id: expenseId,
        p_payer_id: payerId,
        p_amount: amount,
        p_currency: currency,
        p_description: description,
        p_exchange_rate: exchangeRate,
        p_splits: split.map((s) => ({
          user_id: s.userId,
          amount: s.amount,
          amount_base: s.amount * exchangeRate,
        })),
      })

      if (error) throw error

      return { oldExpense: oldExpense as OldExpense }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] })

      const changes: Record<string, unknown> = {}
      const old = data.oldExpense
      if (old) {
        changes.expenseName = variables.description
        if (old.description !== variables.description)
          changes.description = { old: old.description, new: variables.description }
        if (Number(old.amount) !== variables.amount)
          changes.amount = { old: old.amount, new: variables.amount }
        if (old.currency !== variables.currency)
          changes.currency = { old: old.currency, new: variables.currency }
        if (old.payer_id !== variables.payerId) {
          changes.payer = {
            old: old.payer?.display_name ?? old.payer_id,
            new: variables.payerName,
          }
        }
      }

      logActivity(supabase, {
        groupId: variables.groupId,
        action: "expense.update",
        entityType: "expense",
        entityId: variables.expenseId,
        changes,
      })
    },
  })
}

export type ExpenseRefParams = {
  expenseId: string
  groupId: string
  description?: string
  amount?: number
  currency?: string
}

export function useDeleteExpense(): UseMutationResult<
  ExpenseRefParams,
  Error,
  ExpenseRefParams,
  OptimisticContext
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation<ExpenseRefParams, Error, ExpenseRefParams, OptimisticContext>({
    mutationFn: async ({ expenseId, groupId, description, amount, currency }) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("User not authenticated. Please login again.")

      const { data, error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId)
        .select()

      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error("Expense not found or not permitted")
      }

      return { groupId, expenseId, description, amount, currency }
    },
    onMutate: async ({ expenseId, groupId }) => {
      const queryKey: QueryKey = ["group", groupId]
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<GroupDetailsCache>(queryKey)

      if (previous) {
        queryClient.setQueryData<GroupDetailsCache>(queryKey, {
          ...previous,
          expenses: previous.expenses.filter((e) => e.id !== expenseId),
        })
      }

      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      logActivity(supabase, {
        groupId: data.groupId,
        action: "expense.delete",
        entityType: "expense",
        entityId: data.expenseId,
        changes: {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
        },
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense"] })
    },
  })
}

export function useRestoreExpense(): UseMutationResult<
  ExpenseRefParams,
  Error,
  ExpenseRefParams
> {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expenseId,
      groupId,
      description,
      amount,
      currency,
    }: ExpenseRefParams) => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", expenseId)

      if (error) throw error

      return { groupId, expenseId, description, amount, currency }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group", data.groupId] })
      queryClient.invalidateQueries({ queryKey: ["expense"] })
      logActivity(supabase, {
        groupId: data.groupId,
        action: "expense.restore",
        entityType: "expense",
        entityId: data.expenseId,
        changes: {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
        },
      })
    },
  })
}

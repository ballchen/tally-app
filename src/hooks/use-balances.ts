import { useMemo } from "react"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import {
  calculateBalances,
  needsLiveRates,
  type BalanceExpense,
  type BalanceMember,
} from "@/lib/balances"

export type { Debt, Balance } from "@/lib/balances"

export function useBalances(
  expenses: BalanceExpense[] | null | undefined,
  members: BalanceMember[] | null | undefined,
  baseCurrency: string
) {
  const { data: rates, isLoading: ratesLoading } = useExchangeRates()

  return useMemo(() => {
    if (!expenses || !members) return { balances: {}, debts: [], isLoading: false }

    // Only legacy splits without a locked base amount depend on live rates.
    if (needsLiveRates(expenses, baseCurrency) && ratesLoading) {
      return { balances: {}, debts: [], isLoading: true }
    }

    return { ...calculateBalances(expenses, members, baseCurrency, rates), isLoading: false }
  }, [expenses, members, baseCurrency, rates, ratesLoading])
}

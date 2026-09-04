import { useMemo } from "react"
import {
  calculateBalances,
  needsLiveRates,
  type Balance,
  type BalanceExpense,
  type BalanceMember,
  type Debt,
} from "../balances"
import { useExchangeRates } from "./exchange-rates"

export type { Debt, Balance } from "../balances"

export type UseBalancesResult = {
  balances: Balance
  debts: Debt[]
  isLoading: boolean
}

export function useBalances(
  expenses: BalanceExpense[] | null | undefined,
  members: BalanceMember[] | null | undefined,
  baseCurrency: string
): UseBalancesResult {
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

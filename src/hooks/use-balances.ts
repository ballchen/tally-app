import { useMemo } from "react"
import { convertAmount } from "@/lib/currency"
import { useExchangeRates } from "@/hooks/use-exchange-rates"

export type Debt = {
  from: string
  to: string
  amount: number
}

export type Balance = {
  [userId: string]: number
}

export function useBalances(expenses: any[] | null | undefined, members: any[] | null | undefined, baseCurrency: string) {
  const { data: rates, isLoading: ratesLoading } = useExchangeRates()

  return useMemo(() => {
    if (!expenses || !members) return { balances: {}, debts: [], isLoading: false }

    // Only block rendering if there are cross-currency splits that lack a locked base amount
    const needsRates = expenses.some(e =>
      e.currency !== baseCurrency &&
      e.expense_splits?.some((s: any) => s.owed_amount_base == null)
    )
    if (needsRates && ratesLoading) return { balances: {}, debts: [], isLoading: true }

    const balances: Balance = {}

    // Initialize balances
    members.forEach(m => {
      balances[m.user_id] = 0
    })

    // 1. Calculate Net Balances
    // Include ALL expenses (including repayments) in balance calculation
    // Repayments naturally offset debts: when A pays B, A's balance increases, B's decreases
    expenses.forEach(expense => {
      let payerCreditInBase = 0

      if (expense.expense_splits?.length > 0) {
        expense.expense_splits.forEach((split: { user_id: string; owed_amount: number; owed_amount_base: number | null; settlement_id: string | null }) => {
          // Use locked base amount when available; fall back to live conversion for legacy splits
          const splitAmountInBase = split.owed_amount_base != null
            ? split.owed_amount_base
            : convertAmount(split.owed_amount, expense.currency, baseCurrency, rates)

          // Debtor owes this amount (-)
          balances[split.user_id] = (balances[split.user_id] || 0) - splitAmountInBase

          // Payer gains this credit (+)
          payerCreditInBase += splitAmountInBase
        })
      }

      // Add total credit to payer
      balances[expense.payer_id] = (balances[expense.payer_id] || 0) + payerCreditInBase
    })

    // 2. Simplify Debts (Greedy Algorithm)
    const debtors: { id: string, amount: number }[] = []
    const creditors: { id: string, amount: number }[] = []

    Object.entries(balances).forEach(([id, amount]) => {
      // Round to 2 decimals to avoid floating point dust
      const rounded = Math.round(amount * 100) / 100
      if (rounded < -0.01) debtors.push({ id, amount: rounded })
      if (rounded > 0.01) creditors.push({ id, amount: rounded })
    })

    // Sort by magnitude (desc)
    debtors.sort((a, b) => a.amount - b.amount) // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount) // Descending (most positive first)

    const debts: Debt[] = []

    let i = 0 // debtor index
    let j = 0 // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]
      const creditor = creditors[j]

      // amount to settle is min(abs(debt), credit)
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount)

      debts.push({
        from: debtor.id,
        to: creditor.id,
        amount
      })

      // Adjustment
      debtor.amount += amount
      creditor.amount -= amount

      // Move indices if settled (within epsilon)
      if (Math.abs(debtor.amount) < 0.01) i++
      if (creditor.amount < 0.01) j++
    }

    return { balances, debts, isLoading: false }
  }, [expenses, members, baseCurrency, rates, ratesLoading])
}

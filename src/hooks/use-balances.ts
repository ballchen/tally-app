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
  const { data: rates } = useExchangeRates()

  return useMemo(() => {
    // console.log("useBalances inputs:", { expensesCount: expenses?.length, membersCount: members?.length, baseCurrency })
    if (!expenses || !members) return { balances: {}, debts: [] }

    const balances: Balance = {}

    // Initialize balances
    members.forEach(m => {
      balances[m.user_id] = 0
    })

    // 1. Calculate Net Balances
    // 1. Calculate Net Balances
    expenses.forEach(expense => {
      // Skip repayments (they are historical records of settlement, shouldn't affect "Outstanding" debt calculation)
      if (expense.type === 'repayment') return



      let payerCreditInBase = 0

      if (expense.expense_splits?.length > 0) {
        expense.expense_splits.forEach((split: { user_id: string; owed_amount: number; settlement_id: string | null }) => {
          // If split is settled (Granular Settlement), ignore it
          if (split.settlement_id) return

          // Calculate split amount in base currency
          const splitAmountInBase = convertAmount(split.owed_amount, expense.currency, baseCurrency, rates)

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

    return { balances, debts }
  }, [expenses, members, baseCurrency, rates])
}

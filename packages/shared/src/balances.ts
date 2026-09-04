import { convertAmount, type CurrencyData } from "./currency"

export type Debt = {
  from: string
  to: string
  amount: number
}

export type Balance = {
  [userId: string]: number
}

export type BalanceSplit = {
  user_id: string
  owed_amount: number
  owed_amount_base?: number | null
}

export type BalanceExpense = {
  payer_id: string
  currency: string
  expense_splits?: BalanceSplit[] | null
}

export type BalanceMember = { user_id: string }

const EPSILON = 0.01

export function needsLiveRates(expenses: BalanceExpense[], baseCurrency: string): boolean {
  return expenses.some(e =>
    e.currency !== baseCurrency &&
    (e.expense_splits ?? []).some(s => s.owed_amount_base == null)
  )
}

/**
 * Net balance per member in base currency. Positive = is owed, negative = owes.
 * Repayments are ordinary expenses (payer = debtor, split = creditor) so they
 * offset debts without special casing.
 */
export function calculateNetBalances(
  expenses: BalanceExpense[],
  members: BalanceMember[],
  baseCurrency: string,
  rates?: CurrencyData | null
): Balance {
  const balances: Balance = {}
  members.forEach(m => { balances[m.user_id] = 0 })

  expenses.forEach(expense => {
    let payerCredit = 0
    for (const split of expense.expense_splits ?? []) {
      const inBase = split.owed_amount_base != null
        ? Number(split.owed_amount_base)
        : convertAmount(Number(split.owed_amount), expense.currency, baseCurrency, rates)
      balances[split.user_id] = (balances[split.user_id] || 0) - inBase
      payerCredit += inBase
    }
    balances[expense.payer_id] = (balances[expense.payer_id] || 0) + payerCredit
  })

  return balances
}

/** Greedy pairing of largest debtor with largest creditor; minimises transfer count. */
export function simplifyDebts(balances: Balance): Debt[] {
  const debtors: { id: string; amount: number }[] = []
  const creditors: { id: string; amount: number }[] = []

  Object.entries(balances).forEach(([id, amount]) => {
    const rounded = Math.round(amount * 100) / 100
    if (rounded < -EPSILON) debtors.push({ id, amount: rounded })
    if (rounded > EPSILON) creditors.push({ id, amount: rounded })
  })

  debtors.sort((a, b) => a.amount - b.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const debts: Debt[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.round(Math.min(-debtor.amount, creditor.amount) * 100) / 100

    debts.push({ from: debtor.id, to: creditor.id, amount })

    debtor.amount += amount
    creditor.amount -= amount

    if (-debtor.amount < EPSILON) i++
    if (creditor.amount < EPSILON) j++
  }

  return debts
}

export function calculateBalances(
  expenses: BalanceExpense[],
  members: BalanceMember[],
  baseCurrency: string,
  rates?: CurrencyData | null
): { balances: Balance; debts: Debt[] } {
  const balances = calculateNetBalances(expenses, members, baseCurrency, rates)
  return { balances, debts: simplifyDebts(balances) }
}

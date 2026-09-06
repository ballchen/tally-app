import { describe, expect, it } from "vitest"
import { calculateBalances, calculateNetBalances, needsLiveRates, simplifyDebts } from "./balances"

const A = "a", B = "b", C = "c"
const members = [{ user_id: A }, { user_id: B }, { user_id: C }]

const expense = (
  payer: string,
  currency: string,
  splits: Array<[string, number, number | null]>
) => ({
  payer_id: payer,
  currency,
  expense_splits: splits.map(([user_id, owed_amount, owed_amount_base]) => ({ user_id, owed_amount, owed_amount_base })),
})

describe("calculateNetBalances", () => {
  it("credits payer and debits each split", () => {
    const balances = calculateNetBalances(
      [expense(A, "TWD", [[A, 100, 100], [B, 100, 100], [C, 100, 100]])],
      members,
      "TWD"
    )
    expect(balances).toEqual({ [A]: 200, [B]: -100, [C]: -100 })
  })

  it("uses locked base amount instead of live rate for cross-currency splits", () => {
    const rates = { USDTWD: { Exrate: 30, UTC: "" }, USDJPY: { Exrate: 150, UTC: "" } }
    const balances = calculateNetBalances(
      [expense(A, "JPY", [[B, 1500, 400]])],
      members,
      "TWD",
      rates
    )
    // locked 400, live conversion would give 300
    expect(balances[B]).toBe(-400)
    expect(balances[A]).toBe(400)
  })

  it("falls back to live rates for legacy splits without a base amount", () => {
    const rates = { USDTWD: { Exrate: 30, UTC: "" }, USDJPY: { Exrate: 150, UTC: "" } }
    const balances = calculateNetBalances([expense(A, "JPY", [[B, 1500, null]])], members, "TWD", rates)
    expect(balances[B]).toBeCloseTo(-300)
  })

  it("repayment offsets the debt", () => {
    const balances = calculateNetBalances(
      [
        expense(A, "TWD", [[B, 500, 500]]),
        expense(B, "TWD", [[A, 500, 500]]), // B pays A back
      ],
      members,
      "TWD"
    )
    expect(balances[A]).toBe(0)
    expect(balances[B]).toBe(0)
  })

  it("ignores members with no activity but still lists them", () => {
    const balances = calculateNetBalances([], members, "TWD")
    expect(balances).toEqual({ [A]: 0, [B]: 0, [C]: 0 })
  })
})

describe("simplifyDebts", () => {
  it("returns no debts when everyone is settled", () => {
    expect(simplifyDebts({ [A]: 0, [B]: 0.004, [C]: -0.004 })).toEqual([])
  })

  it("pairs largest debtor with largest creditor", () => {
    const debts = simplifyDebts({ [A]: 300, [B]: -100, [C]: -200 })
    expect(debts).toEqual([
      { from: C, to: A, amount: 200 },
      { from: B, to: A, amount: 100 },
    ])
  })

  it("splits a debtor across creditors when needed", () => {
    const debts = simplifyDebts({ [A]: 150, [B]: 50, [C]: -200 })
    expect(debts).toEqual([
      { from: C, to: A, amount: 150 },
      { from: C, to: B, amount: 50 },
    ])
  })

  it("rounds floating point dust to cents", () => {
    const debts = simplifyDebts({ [A]: 33.333333, [B]: -33.333333 })
    expect(debts).toEqual([{ from: B, to: A, amount: 33.33 }])
  })
})

describe("calculateBalances end to end", () => {
  it("three-way dinner then partial repayment", () => {
    const expenses = [
      expense(A, "TWD", [[A, 300, 300], [B, 300, 300], [C, 300, 300]]),
      expense(B, "TWD", [[A, 100, 100]]), // B repays 100
    ]
    const { debts } = calculateBalances(expenses, members, "TWD")
    expect(debts).toEqual([
      { from: C, to: A, amount: 300 },
      { from: B, to: A, amount: 200 },
    ])
  })
})

describe("needsLiveRates", () => {
  it("is false when all cross-currency splits are locked", () => {
    expect(needsLiveRates([expense(A, "JPY", [[B, 1, 0.2]])], "TWD")).toBe(false)
  })
  it("is true when a cross-currency split lacks a base amount", () => {
    expect(needsLiveRates([expense(A, "JPY", [[B, 1, null]])], "TWD")).toBe(true)
  })
  it("is false for same-currency splits without a base amount", () => {
    expect(needsLiveRates([expense(A, "TWD", [[B, 1, null]])], "TWD")).toBe(false)
  })
})

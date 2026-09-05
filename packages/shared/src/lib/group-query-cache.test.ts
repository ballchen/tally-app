import { describe, expect, it } from "vitest"
import { buildOptimisticExpense, type CreateExpenseParams } from "./group-query-cache"

const USER = { id: "u1", email: "a@example.com" }
const MEMBERS = [
  { user_id: "u1", profiles: { display_name: "Ann", avatar_url: null } },
  { user_id: "u2", profiles: { display_name: "Bob", avatar_url: null } },
]

function params(overrides: Partial<CreateExpenseParams> = {}): CreateExpenseParams {
  return {
    groupId: "g1",
    payerId: "u1",
    amount: 100,
    currency: "TWD",
    description: "Lunch",
    exchangeRate: 1,
    split: [
      { userId: "u1", amount: 50 },
      { userId: "u2", amount: 50 },
    ],
    ...overrides,
  }
}

describe("buildOptimisticExpense", () => {
  it("uses the supplied date", () => {
    const date = "2026-08-14T03:00:00.000Z"
    expect(buildOptimisticExpense(params({ date }), USER, MEMBERS, "tmp").date).toBe(date)
  })

  it("falls back to now when no date is given", () => {
    const before = Date.now()
    const built = buildOptimisticExpense(params(), USER, MEMBERS, "tmp")
    expect(new Date(built.date).getTime()).toBeGreaterThanOrEqual(before)
  })

  it("locks each split's base amount with the given rate", () => {
    const built = buildOptimisticExpense(params({ exchangeRate: 0.25 }), USER, MEMBERS, "tmp")
    expect(built.expense_splits.map((s) => s.owed_amount_base)).toEqual([12.5, 12.5])
  })
})

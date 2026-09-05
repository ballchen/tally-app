import { describe, expect, it } from "vitest"
import {
  buildOptimisticExpense,
  insertExpenseByDate,
  type CreateExpenseParams,
} from "./group-query-cache"

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

describe("insertExpenseByDate", () => {
  const timeline = [
    { id: "c", date: "2026-09-03T00:00:00+00:00" },
    { id: "b", date: "2026-08-20T00:00:00+00:00" },
    { id: "a", date: "2026-07-01T00:00:00+00:00" },
  ]

  it("puts a new expense at the top", () => {
    const built = insertExpenseByDate(timeline, { id: "x", date: "2026-09-04T00:00:00.000Z" })
    expect(built.map((e) => e.id)).toEqual(["x", "c", "b", "a"])
  })

  it("puts a backdated expense in date order", () => {
    const built = insertExpenseByDate(timeline, { id: "x", date: "2026-08-25T00:00:00.000Z" })
    expect(built.map((e) => e.id)).toEqual(["c", "x", "b", "a"])
  })

  it("puts the oldest expense last", () => {
    const built = insertExpenseByDate(timeline, { id: "x", date: "2020-01-01T00:00:00.000Z" })
    expect(built.map((e) => e.id)).toEqual(["c", "b", "a", "x"])
  })

  it("compares instants, not the string form of the timestamp", () => {
    const built = insertExpenseByDate([{ id: "z", date: "2026-09-03T00:00:00+08:00" }], {
      id: "x",
      date: "2026-09-02T20:00:00.000Z",
    })
    expect(built.map((e) => e.id)).toEqual(["x", "z"])
  })
})

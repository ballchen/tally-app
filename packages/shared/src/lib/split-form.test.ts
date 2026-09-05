import { describe, expect, it } from "vitest"
import { allocatedTotal, computeSplits, minorUnit, type ComputeSplitsInput } from "./split-form"

const MEMBERS = ["u1", "u2", "u3"]

function input(overrides: Partial<ComputeSplitsInput> = {}): ComputeSplitsInput {
  return {
    splitMode: "EQUAL",
    amount: 100,
    currency: "TWD",
    memberIds: MEMBERS,
    involvedIds: MEMBERS,
    exactAmounts: {},
    percentAmounts: {},
    ...overrides,
  }
}

const total = (splits: { amount: number }[]) => splits.reduce((sum, s) => sum + s.amount, 0)

describe("minorUnit", () => {
  it("is a whole unit for zero-decimal currencies", () => {
    expect(minorUnit("TWD")).toBe(1)
    expect(minorUnit("JPY")).toBe(1)
  })

  it("is a cent elsewhere", () => {
    expect(minorUnit("USD")).toBe(0.01)
  })
})

describe("allocatedTotal", () => {
  it("adds up only the current members' entries", () => {
    expect(allocatedTotal({ u1: 60, u2: 40, gone: 25 }, MEMBERS)).toBe(100)
  })

  it("leaves the whole amount remaining when a departed member held it all", () => {
    expect(100 - allocatedTotal({ gone: 100 }, MEMBERS)).toBe(100)
  })
})

describe("computeSplits — equal", () => {
  it("splits 100 TWD three ways as 34/33/33", () => {
    const splits = computeSplits(input())
    expect(splits.map((s) => s.amount)).toEqual([34, 33, 33])
    expect(total(splits)).toBe(100)
  })

  it("splits 100 USD three ways as 33.34/33.33/33.33", () => {
    const splits = computeSplits(input({ currency: "USD" }))
    expect(splits.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33])
    expect(total(splits)).toBeCloseTo(100, 10)
  })

  it("divides evenly when there is no remainder", () => {
    const splits = computeSplits(input({ amount: 900 }))
    expect(splits.map((s) => s.amount)).toEqual([300, 300, 300])
  })

  it("ignores an involved id that is no longer a member", () => {
    const splits = computeSplits(input({ involvedIds: [...MEMBERS, "gone"] }))
    expect(splits.map((s) => s.userId)).toEqual(MEMBERS)
    expect(total(splits)).toBe(100)
  })

  it("returns nothing when nobody is involved", () => {
    expect(computeSplits(input({ involvedIds: [] }))).toEqual([])
  })
})

describe("computeSplits — exact", () => {
  it("keeps each entered amount, rounded to the currency", () => {
    const splits = computeSplits(
      input({ splitMode: "EXACT", exactAmounts: { u1: 60.4, u2: 39.6 } })
    )
    expect(splits).toEqual([
      { userId: "u1", amount: 60 },
      { userId: "u2", amount: 40 },
    ])
  })

  it("drops amounts entered for a member who left", () => {
    const splits = computeSplits(
      input({ splitMode: "EXACT", exactAmounts: { u1: 60, u2: 40, gone: 25 } })
    )
    expect(splits.map((s) => s.userId)).toEqual(["u1", "u2"])
  })
})

describe("computeSplits — percent", () => {
  it("gives the last participant the rounding remainder", () => {
    const splits = computeSplits(
      input({
        splitMode: "PERCENT",
        currency: "USD",
        percentAmounts: { u1: 33.33, u2: 33.33, u3: 33.33 },
      })
    )
    expect(splits.map((s) => s.amount)).toEqual([33.33, 33.33, 33.34])
    expect(total(splits)).toBeCloseTo(100, 10)
  })

  it("sums to the exact amount in a zero-decimal currency", () => {
    const splits = computeSplits(
      input({ splitMode: "PERCENT", percentAmounts: { u1: 33.33, u2: 33.33, u3: 33.34 } })
    )
    expect(total(splits)).toBe(100)
  })

  it("only counts percentages of current members", () => {
    const splits = computeSplits(
      input({ splitMode: "PERCENT", percentAmounts: { u1: 50, u2: 50, gone: 50 } })
    )
    expect(splits).toEqual([
      { userId: "u1", amount: 50 },
      { userId: "u2", amount: 50 },
    ])
  })
})

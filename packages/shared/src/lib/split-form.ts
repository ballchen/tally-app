import { useState, useMemo } from "react"
import { getCurrencyDecimals } from "../currency"

interface Member {
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export type SplitMode = "EQUAL" | "EXACT" | "PERCENT"

export type Split = { userId: string; amount: number }

export type ComputeSplitsInput = {
  splitMode: SplitMode
  amount: number
  currency: string
  /** Group order; the split output follows it, and remainders land on the first rows. */
  memberIds: string[]
  involvedIds: string[]
  exactAmounts: Record<string, number>
  percentAmounts: Record<string, number>
}

/** Smallest representable amount in `currency` — 1 for TWD/JPY, 0.01 for USD. */
export function minorUnit(currency: string): number {
  return 1 / 10 ** getCurrencyDecimals(currency)
}

function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** getCurrencyDecimals(currency))
}

function toMajor(units: number, currency: string): number {
  return units / 10 ** getCurrencyDecimals(currency)
}

/**
 * Splits an amount so the parts sum to it exactly, in the currency's smallest
 * unit. Anything left over after an even division goes to the earliest members,
 * so a group never owes a rounded-away cent to nobody.
 */
export function computeSplits({
  splitMode,
  amount,
  currency,
  memberIds,
  involvedIds,
  exactAmounts,
  percentAmounts,
}: ComputeSplitsInput): Split[] {
  const totalUnits = toMinorUnits(amount, currency)

  if (splitMode === "EXACT") {
    return memberIds
      .map((userId) => ({
        userId,
        amount: toMajor(toMinorUnits(exactAmounts[userId] ?? 0, currency), currency),
      }))
      .filter((s) => s.amount > 0)
  }

  if (splitMode === "PERCENT") {
    const participants = memberIds.filter((id) => (percentAmounts[id] ?? 0) > 0)
    let assigned = 0
    return participants
      .map((userId, index) => {
        // The last share absorbs the rounding drift of all the others.
        const units =
          index === participants.length - 1
            ? totalUnits - assigned
            : toMinorUnits(((percentAmounts[userId] ?? 0) / 100) * amount, currency)
        assigned += units
        return { userId, amount: toMajor(units, currency) }
      })
      .filter((s) => s.amount > 0)
  }

  const participants = memberIds.filter((id) => involvedIds.includes(id))
  if (participants.length === 0) return []

  const share = Math.floor(totalUnits / participants.length)
  const remainder = totalUnits - share * participants.length
  return participants
    .map((userId, index) => ({
      userId,
      amount: toMajor(share + (index < remainder ? 1 : 0), currency),
    }))
    .filter((s) => s.amount > 0)
}

/** Entries keyed by someone who is no longer a member must not count as allocated. */
export function allocatedTotal(
  values: Record<string, number>,
  memberIds: string[]
): number {
  return memberIds.reduce((total, id) => total + (values[id] ?? 0), 0)
}

export function useSplitForm(
  amount: number,
  members: Member[],
  currentUserId?: string | null,
  currency = "TWD"
) {
  const [splitMode, setSplitMode] = useState<SplitMode>("EQUAL")
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({})
  const [percentAmounts, setPercentAmounts] = useState<Record<string, number>>({})

  const [description, setDescription] = useState("")
  // null = "not chosen yet": defaults derive from user/members once they load.
  const [chosenPayerId, setPayerId] = useState<string | null>(null)
  const [chosenInvolvedIds, setInvolvedIds] = useState<string[] | null>(null)

  const payerId = chosenPayerId ?? currentUserId ?? ""
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members])

  // A member who left must stop counting towards the allocation, or the form
  // stays "balanced" on money nobody in the group owes.
  const involvedIds = useMemo(
    () =>
      chosenInvolvedIds === null
        ? memberIds
        : chosenInvolvedIds.filter((id) => memberIds.includes(id)),
    [chosenInvolvedIds, memberIds]
  )

  const toggleInvolved = (userId: string) => {
    if (splitMode !== "EQUAL") return

    setInvolvedIds((prev) => {
      const current = prev ?? memberIds
      return current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    })
  }

  const handleAmountChange = (userId: string, val: string) => {
    const num = parseFloat(val) || 0
    if (num < 0) return
    setExactAmounts((prev) => ({ ...prev, [userId]: num }))
  }

  const handlePercentChange = (userId: string, val: string) => {
    const num = parseFloat(val) || 0
    if (num < 0) return
    setPercentAmounts((prev) => ({ ...prev, [userId]: num }))
  }

  const remainingExact = amount - allocatedTotal(exactAmounts, memberIds)
  const remainingPercent = 100 - allocatedTotal(percentAmounts, memberIds)

  const isValid = () => {
    if (splitMode === "EQUAL") return involvedIds.length > 0
    if (splitMode === "EXACT") return Math.abs(remainingExact) < minorUnit(currency) / 2
    // 33.33 × 3 = 99.99 must be accepted; computeSplits gives the remainder to the last participant.
    if (splitMode === "PERCENT") return Math.abs(remainingPercent) < 0.1
    return false
  }

  const splits = computeSplits({
    splitMode,
    amount,
    currency,
    memberIds,
    involvedIds,
    exactAmounts,
    percentAmounts,
  })

  const getSplits = () => splits

  const splitAmounts: Record<string, number> = {}
  for (const split of splits) splitAmounts[split.userId] = split.amount

  return {
    // State
    splitMode, setSplitMode,
    exactAmounts, handleAmountChange,
    percentAmounts, handlePercentChange,
    description, setDescription,
    payerId, setPayerId,
    involvedIds, toggleInvolved,

    // Derived
    remainingExact,
    remainingPercent,
    isValid: isValid(),
    getSplits,
    splitAmounts,

    // Reset helper
    reset: () => {
      setSplitMode("EQUAL")
      setExactAmounts({})
      setPercentAmounts({})
      setDescription("")
      setPayerId(null)
      setInvolvedIds(null)
    },

    setValues: (data: {
      amount: number,
      description: string,
      payerId: string,
      splits: Split[],
      /** The saved expense's currency, which the form may not have adopted yet. */
      currency?: string,
    }) => {
      setDescription(data.description)
      setPayerId(data.payerId)

      const savedCurrency = data.currency ?? currency
      const activeSplits = data.splits.filter((s) => s.amount > 0)
      const participantIds = activeSplits.map((s) => s.userId)
      const equalSplits = computeSplits({
        splitMode: "EQUAL",
        amount: data.amount,
        currency: savedCurrency,
        memberIds: participantIds,
        involvedIds: participantIds,
        exactAmounts: {},
        percentAmounts: {},
      })

      const isEqual =
        activeSplits.length > 0 &&
        equalSplits.length === activeSplits.length &&
        equalSplits.every((expected) => {
          const actual = activeSplits.find((s) => s.userId === expected.userId)
          return actual != null && Math.abs(actual.amount - expected.amount) < minorUnit(savedCurrency)
        })

      if (isEqual) {
        setSplitMode("EQUAL")
        setInvolvedIds(participantIds)
        setExactAmounts({})
        setPercentAmounts({})
      } else {
        // Exact preserves whatever allocation was saved, however uneven.
        setSplitMode("EXACT")
        const newExacts: Record<string, number> = {}
        activeSplits.forEach((s) => {
          newExacts[s.userId] = s.amount
        })
        setExactAmounts(newExacts)
        setInvolvedIds([])
      }
    }
  }
}

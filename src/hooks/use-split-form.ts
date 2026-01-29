import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/useAuthStore"

interface Member {
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export function useSplitForm(amount: number, members: Member[]) {
  const { user } = useAuthStore()

  const [splitMode, setSplitMode] = useState<"EQUAL" | "EXACT" | "PERCENT">("EQUAL")
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({})
  const [percentAmounts, setPercentAmounts] = useState<Record<string, number>>({})

  const [description, setDescription] = useState("")
  const [payerId, setPayerId] = useState("")
  const [involvedIds, setInvolvedIds] = useState<string[]>([])

  // Initialize defaults
  useEffect(() => {
    if (user && !payerId) {
      setPayerId(user.id)
    }
  }, [user])

  useEffect(() => {
    // Initialize involvedIds with everyone if empty
    if (members.length > 0 && involvedIds.length === 0) {
      setInvolvedIds(members.map(m => m.user_id))
    }
  }, [members])


  const toggleInvolved = (userId: string) => {
    if (splitMode !== "EQUAL") return

    setInvolvedIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleAmountChange = (userId: string, val: string) => {
    const num = parseFloat(val) || 0
    // Prevent negative amounts
    if (num < 0) return
    setExactAmounts(prev => ({ ...prev, [userId]: num }))
  }

  const handlePercentChange = (userId: string, val: string) => {
    const num = parseFloat(val) || 0
    // Prevent negative percentages
    if (num < 0) return
    setPercentAmounts(prev => ({ ...prev, [userId]: num }))
  }

  // Validations
  const currentTotalExact = Object.values(exactAmounts).reduce((a, b) => a + b, 0)
  const currentTotalPercent = Object.values(percentAmounts).reduce((a, b) => a + b, 0)

  const remainingExact = amount - currentTotalExact
  const remainingPercent = 100 - currentTotalPercent

  const isValid = () => {
    if (splitMode === "EQUAL") return involvedIds.length > 0
    if (splitMode === "EXACT") return Math.abs(remainingExact) < 0.01
    if (splitMode === "PERCENT") return Math.abs(remainingPercent) < 0.1
    return false
  }

  const getSplits = () => {
    return members.map(m => {
      let calculatedAmount = 0
      if (splitMode === "EQUAL") {
        if (involvedIds.includes(m.user_id)) {
          calculatedAmount = amount / involvedIds.length
        }
      } else if (splitMode === "EXACT") {
        calculatedAmount = exactAmounts[m.user_id] || 0
      } else if (splitMode === "PERCENT") {
        const pct = percentAmounts[m.user_id] || 0
        calculatedAmount = (pct / 100) * amount
      }
      return { userId: m.user_id, amount: calculatedAmount }
    }).filter(s => s.amount > 0.001)
  }

  // Helpers for UI
  const splitAmountEqual = involvedIds.length > 0 ? amount / involvedIds.length : 0

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
    splitAmountEqual,

    // Reset helper
    reset: () => {
      setSplitMode("EQUAL")
      setExactAmounts({})
      setPercentAmounts({})
      setDescription("")
      setPayerId(user?.id || "")
      if (members.length > 0) setInvolvedIds(members.map(m => m.user_id))
    },

    setValues: (data: {
      amount: number,
      description: string,
      payerId: string,
      splits: { userId: string, amount: number }[]
    }) => {
      setDescription(data.description)
      setPayerId(data.payerId)

      // Infer Split Mode
      // 1. Check if all splits are roughly equal (allow small precision error)
      const totalAmount = data.amount
      const activeSplits = data.splits.filter(s => s.amount > 0.001)
      const count = activeSplits.length

      let isEqual = false
      if (count > 0 && Math.abs(totalAmount - data.splits.reduce((sum, s) => sum + s.amount, 0)) < 0.05) {
        const expectedAmount = totalAmount / count
        const allMatch = activeSplits.every(s => Math.abs(s.amount - expectedAmount) < 0.05)
        if (allMatch) {
          isEqual = true
        }
      }

      if (isEqual) {
        setSplitMode("EQUAL")
        setInvolvedIds(activeSplits.map(s => s.userId))
        setExactAmounts({})
        setPercentAmounts({})
      } else {
        // Default to EXACT for non-equal splits to preserve precision
        setSplitMode("EXACT")
        const newExacts: Record<string, number> = {}
        data.splits.forEach(s => {
          if (s.amount > 0) newExacts[s.userId] = s.amount
        })
        setExactAmounts(newExacts)
        setInvolvedIds([]) // Not used in EXACT mode
      }
    }
  }
}


import { useEffect } from "react"
import { useSupabase } from "../supabase-context"
import { useDebouncedInvalidate } from "./use-debounced-invalidate"

export type RealtimeEvent =
  | { type: "expense.added" }
  | { type: "expense.updated" }
  | { type: "expense.deleted" }
  | { type: "settlement.recorded" }
  | { type: "settlement.undone" }
  | { type: "member.joined" }

export type RealtimeSyncOptions = {
  currentUserId?: string | null
  onEvent?: (event: RealtimeEvent) => void
}

type ExpenseRow = {
  created_by?: string
  payer_id?: string
  type?: string
  deleted_at?: string | null
}

/**
 * Keeps a group's React Query cache in sync with postgres_changes and reports
 * changes made by *other* members through onEvent.
 */
export function useRealtimeSync(
  groupId: string,
  { currentUserId, onEvent }: RealtimeSyncOptions = {}
): void {
  const debouncedInvalidate = useDebouncedInvalidate()
  const supabase = useSupabase()

  useEffect(() => {
    if (!groupId) return

    const membersChannel = supabase
      .channel(`group-members-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          debouncedInvalidate(["group", groupId])

          if (
            payload.eventType === "INSERT" &&
            payload.new.user_id !== currentUserId
          ) {
            onEvent?.({ type: "member.joined" })
          }
        }
      )
      .subscribe()

    const expensesChannel = supabase
      .channel(`expenses-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.new as ExpenseRow | undefined
          const isOwnChange =
            row?.created_by === currentUserId || row?.payer_id === currentUserId
          // The mutation that made this change already invalidated the same
          // query on success; invalidating again here just re-fetches a
          // moment later and can flip the timeline mid-tap in a UI test.
          if (isOwnChange) return
          debouncedInvalidate(["group", groupId])

          // Repayments are announced by the settlements channel.
          if (row?.type === "repayment") return

          if (payload.eventType === "INSERT") {
            onEvent?.({ type: "expense.added" })
          } else if (payload.eventType === "UPDATE") {
            onEvent?.({
              type: row?.deleted_at ? "expense.deleted" : "expense.updated",
            })
          }
        }
      )
      .subscribe()

    const settlementsChannel = supabase
      .channel(`settlements-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settlements",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as
            | { created_by?: string }
            | undefined
          // The mutation that made this change already invalidated the same
          // query on success; invalidating again here just re-fetches a
          // moment later and can flip the timeline mid-tap in a UI test.
          if (row?.created_by === currentUserId) return
          debouncedInvalidate(["group", groupId])

          if (payload.eventType === "INSERT") {
            onEvent?.({ type: "settlement.recorded" })
          } else if (payload.eventType === "DELETE") {
            onEvent?.({ type: "settlement.undone" })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(membersChannel)
      supabase.removeChannel(expensesChannel)
      supabase.removeChannel(settlementsChannel)
    }
  }, [groupId, debouncedInvalidate, supabase, currentUserId, onEvent])
}

export type RealtimeGroupsOptions = {
  onJoined?: () => void
}

/** Detects the current user being added to a new group (groups list screen). */
export function useRealtimeGroups(
  userId: string | null | undefined,
  { onJoined }: RealtimeGroupsOptions = {}
): void {
  const debouncedInvalidate = useDebouncedInvalidate()
  const supabase = useSupabase()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`user-groups-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedInvalidate(["groups"])
          onJoined?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, debouncedInvalidate, supabase, onJoined])
}

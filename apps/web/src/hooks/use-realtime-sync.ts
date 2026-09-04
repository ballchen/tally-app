import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  useRealtimeGroups as useSharedRealtimeGroups,
  useRealtimeSync as useSharedRealtimeSync,
  type RealtimeEvent,
} from "@tally/shared/queries/realtime"
import { useAuthStore } from "@/store/useAuthStore"

const TOAST_KEY: Record<RealtimeEvent["type"], string> = {
  "member.joined": "memberJoined",
  "expense.added": "expenseAdded",
  "expense.updated": "expenseUpdated",
  "expense.deleted": "expenseDeleted",
  "settlement.recorded": "settlementRecorded",
  "settlement.undone": "settlementUndone",
}

export function useRealtimeSync(groupId: string) {
  const { user } = useAuthStore()
  const t = useTranslations("Realtime")

  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      toast.info(t(TOAST_KEY[event.type]))
    },
    [t]
  )

  useSharedRealtimeSync(groupId, { currentUserId: user?.id, onEvent })
}

export function useRealtimeGroups() {
  const { user } = useAuthStore()
  const t = useTranslations("Realtime")

  const onJoined = useCallback(() => {
    toast.success(t("joinedGroup"))
  }, [t])

  useSharedRealtimeGroups(user?.id, { onJoined })
}

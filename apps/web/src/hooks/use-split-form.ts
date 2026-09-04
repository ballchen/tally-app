import { useSplitForm as useSharedSplitForm } from "@tally/shared/lib/split-form"
import { useAuthStore } from "@/store/useAuthStore"

type Member = {
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export function useSplitForm(amount: number, members: Member[]) {
  const { user } = useAuthStore()
  return useSharedSplitForm(amount, members, user?.id)
}

import { createClient } from "@/lib/supabase/client"
import { useInfiniteQuery } from "@tanstack/react-query"

export type ActivityLog = {
  id: string
  group_id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string | null
  changes: Record<string, unknown>
  created_at: string
  profiles: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

const PAGE_SIZE = 20

export function useActivityLogs(groupId: string) {
  const supabase = createClient()

  return useInfiniteQuery({
    queryKey: ["activity-logs", groupId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, profiles:actor_id(display_name, avatar_url)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error
      return { data: (data ?? []) as ActivityLog[], page: pageParam }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < PAGE_SIZE) return undefined
      return lastPage.page + 1
    },
    enabled: !!groupId,
  })
}

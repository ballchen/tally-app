import type { GroupFilter } from "@/hooks/use-groups"

type GroupListItem = {
  archived_at: string | null
  group_members?: { user_id?: string; hidden_at: string | null }[] | null
}

export function filterUserGroups<T extends GroupListItem>(
  groups: T[] | undefined,
  filter: GroupFilter
): T[] | undefined {
  if (!groups) return undefined

  if (filter === "all") return groups

  if (filter === "archived") {
    return groups.filter((g) => !!g.archived_at)
  }

  if (filter === "hidden") {
    return groups.filter((g) =>
      g.group_members?.some((m) => m.hidden_at)
    )
  }

  // active: not archived and not hidden for current user
  return groups.filter(
    (g) =>
      !g.archived_at &&
      !g.group_members?.some((m) => m.hidden_at)
  )
}

export function getGroupFilterCounts(groups: GroupListItem[] | undefined) {
  if (!groups) {
    return { archivedCount: 0, hiddenCount: 0 }
  }

  return {
    archivedCount: groups.filter((g) => !!g.archived_at).length,
    hiddenCount: groups.filter((g) =>
      g.group_members?.some((m) => m.hidden_at)
    ).length,
  }
}

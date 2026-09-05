import type { GroupMember } from '@tally/shared/members';

/**
 * `get_group_members_batch` has no ORDER BY, so Postgres can return a group's
 * members in a different order between calls. Sorting here keeps "who paid?",
 * the allocations list, and member settings from reshuffling on every refetch.
 * `joined_at` ties (e.g. members seeded in one batch) fall back to `user_id`
 * so the order is fully deterministic.
 */
export function sortMembers<T extends Pick<GroupMember, 'user_id' | 'joined_at'>>(
  members: T[],
): T[] {
  return [...members].sort((a, b) => {
    const byJoinedAt = a.joined_at.localeCompare(b.joined_at);
    return byJoinedAt !== 0 ? byJoinedAt : a.user_id.localeCompare(b.user_id);
  });
}

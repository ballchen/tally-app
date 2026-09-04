import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslations } from 'next-intl'
import { useDebouncedInvalidate } from '@/hooks/use-debounced-invalidate'

/**
 * Hook to subscribe to realtime changes for a specific group.
 * When group_members or expenses change, it invalidates React Query cache
 * and shows toast notifications.
 */
export function useRealtimeSync(groupId: string) {
  const debouncedInvalidate = useDebouncedInvalidate()
  const supabase = createClient()
  const { user } = useAuthStore()
  const t = useTranslations('Realtime')

  useEffect(() => {
    if (!groupId) return

    // Subscribe to group_members changes
    const membersChannel = supabase
      .channel(`group-members-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        // Invalidate queries to refetch
        debouncedInvalidate(['group', groupId])

        // Show toast for INSERT events from other users
        if (payload.eventType === 'INSERT' && payload.new.user_id !== user?.id) {
          toast.info(t('memberJoined'))
        }
      })
      .subscribe()

    const expensesChannel = supabase
      .channel(`expenses-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'expenses',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        debouncedInvalidate(['group', groupId])

        const row = payload.new as { created_by?: string; payer_id?: string; type?: string; deleted_at?: string | null } | undefined
        const isOwnChange = row?.created_by === user?.id || row?.payer_id === user?.id
        // Repayments are announced by the settlements channel.
        if (isOwnChange || row?.type === 'repayment') return

        if (payload.eventType === 'INSERT') {
          toast.info(t('expenseAdded'))
        } else if (payload.eventType === 'UPDATE') {
          toast.info(row?.deleted_at ? t('expenseDeleted') : t('expenseUpdated'))
        }
      })
      .subscribe()

    const settlementsChannel = supabase
      .channel(`settlements-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'settlements',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        debouncedInvalidate(['group', groupId])

        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { created_by?: string } | undefined
        if (row?.created_by === user?.id) return

        if (payload.eventType === 'INSERT') {
          toast.info(t('settlementRecorded'))
        } else if (payload.eventType === 'DELETE') {
          toast.info(t('settlementUndone'))
        }
      })
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(membersChannel)
      supabase.removeChannel(expensesChannel)
      supabase.removeChannel(settlementsChannel)
    }
  }, [groupId, debouncedInvalidate, supabase, user?.id, t])
}

/**
 * Hook to subscribe to realtime changes for the current user's groups.
 * Used on the groups list page to detect when user is added to new groups.
 */
export function useRealtimeGroups() {
  const debouncedInvalidate = useDebouncedInvalidate()
  const supabase = createClient()
  const { user } = useAuthStore()
  const t = useTranslations('Realtime')

  useEffect(() => {
    if (!user?.id) return

    // Subscribe to group_members for current user
    const channel = supabase
      .channel(`user-groups-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Invalidate groups list to refetch
        debouncedInvalidate(['groups'])
        toast.success(t('joinedGroup'))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, debouncedInvalidate, supabase, t])
}

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
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

  useEffect(() => {
    if (!groupId) return

    const invalidateGroup = () => {
      debouncedInvalidate(['group', groupId])
    }

    const membersChannel = supabase
      .channel(`group-members-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        invalidateGroup()

        if (payload.eventType === 'INSERT' && payload.new.user_id !== user?.id) {
          toast.info('A new member joined the group!')
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
        invalidateGroup()

        const isOwnChange = (payload.new as { created_by?: string; payer_id?: string })?.created_by === user?.id ||
          (payload.new as { payer_id?: string })?.payer_id === user?.id

        if (!isOwnChange) {
          if (payload.eventType === 'INSERT') {
            toast.info('New expense added!')
          } else if (payload.eventType === 'UPDATE') {
            toast.info('An expense was updated!')
          } else if (payload.eventType === 'DELETE') {
            toast.info('An expense was deleted!')
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(membersChannel)
      supabase.removeChannel(expensesChannel)
    }
  }, [groupId, debouncedInvalidate, supabase, user?.id])
}

/**
 * Hook to subscribe to realtime changes for the current user's groups.
 * Used on the groups list page to detect when user is added to new groups.
 */
export function useRealtimeGroups() {
  const debouncedInvalidate = useDebouncedInvalidate()
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`user-groups-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${user.id}`
      }, () => {
        debouncedInvalidate(['groups'])
        toast.success('You joined a new group!')
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, debouncedInvalidate, supabase])
}

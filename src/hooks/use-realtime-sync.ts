import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'

/**
 * Hook to subscribe to realtime changes for a specific group.
 * When group_members or expenses change, it invalidates React Query cache
 * and shows toast notifications.
 */
export function useRealtimeSync(groupId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { user } = useAuthStore()

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
        queryClient.invalidateQueries({ queryKey: ['group', groupId] })

        // Show toast for INSERT events from other users
        if (payload.eventType === 'INSERT' && payload.new.user_id !== user?.id) {
          toast.info('A new member joined the group!')
        }
      })
      .subscribe()

    // Subscribe to expenses changes
    const expensesChannel = supabase
      .channel(`expenses-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'expenses',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['group', groupId] })

        // Show toast for changes from other users
        const isOwnChange = (payload.new as any)?.created_by === user?.id ||
          (payload.new as any)?.payer_id === user?.id

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

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(membersChannel)
      supabase.removeChannel(expensesChannel)
    }
  }, [groupId, queryClient, supabase, user?.id])
}

/**
 * Hook to subscribe to realtime changes for the current user's groups.
 * Used on the groups list page to detect when user is added to new groups.
 */
export function useRealtimeGroups() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { user } = useAuthStore()

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
        queryClient.invalidateQueries({ queryKey: ['groups'] })
        toast.success('You joined a new group!')
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient, supabase])
}

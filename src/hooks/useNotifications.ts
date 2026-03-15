// hooks/useNotifications.ts
// Spec 5.6 — loads 50 recent notifications, subscribes to INSERT
// C-06B: column is now `user_id` (renamed from recipient_id), `read` (renamed from is_read)
// Pass 3: plays notification sounds + dismiss/dismissAll aliases
import { useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import { playNotificationSound } from '@/lib/sounds'

export function useNotifications() {
  const {
    v3Notifications,
    unreadNotifCount,
    addNotification,
    markNotificationRead,
    markAllNotifsRead,
    user,
  } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!user?.id) return

    // Load recent notifications
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          // Add in reverse so most recent ends up at top via unshift
          ;[...data].reverse().forEach((n) => addNotification(n as any))
        }
      })

    // Realtime: subscribe to new notifications for this user
    const sub = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as any
          addNotification(notif)
          playNotificationSound(notif.type ?? 'message')
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [user?.id])

  const markRead = useCallback(
    async (id: string) => {
      markNotificationRead(id)
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', id)
    },
    []
  )

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    markAllNotifsRead()
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false)
  }, [user?.id])

  return {
    notifications: v3Notifications,
    unreadCount: unreadNotifCount,
    markRead,
    markAllRead,
    // Pass 3 aliases used by NotificationBell
    dismiss: markRead,
    dismissAll: markAllRead,
  }
}

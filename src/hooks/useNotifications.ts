// hooks/useNotifications.ts
import { useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useNotifications() {
  const {
    notifications,
    unreadNotifCount,
    addNotification,
    markNotificationRead,
    markAllNotifsRead,
    user,
  } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!user?.id) return

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) [...data].reverse().forEach(n => addNotification(n as any))
      })

    const sub = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => addNotification(payload.new as any))
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [user?.id])

  const markRead = useCallback(async (id: string) => {
    markNotificationRead(id)
    await supabase.from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    markAllNotifsRead()
    await supabase.from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false)
  }, [user?.id])

  return {
    notifications,
    unreadCount: unreadNotifCount,
    markRead,
    markAllRead,
    dismiss: markRead,
    dismissAll: markAllRead,
  }
}

}

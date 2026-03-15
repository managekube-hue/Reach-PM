// hooks/useUnreadCounts.ts
// Spec 5.4 — channel_last_read + message counts
// C-12: user from store
import { useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useUnreadCounts() {
  const { user, unreadCounts, setUnreadCount } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!user?.id) return

    supabase
      .from('channel_last_read')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id)
      .then(({ data: reads }) => {
        if (!reads) return
        reads.forEach(async (read) => {
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', read.channel_id)
            .eq('deleted', false)
            .is('thread_of', null)
            .gt('created_at', read.last_read_at)
          setUnreadCount(read.channel_id, count ?? 0)
        })
      })
  }, [user?.id])

  const markRead = useCallback(
    async (channelId: string) => {
      if (!user?.id) return
      setUnreadCount(channelId, 0)
      await supabase.from('channel_last_read').upsert(
        {
          user_id: user.id,
          channel_id: channelId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,channel_id' }
      )
    },
    [user?.id]
  )

  return { unreadCounts, markRead }
}

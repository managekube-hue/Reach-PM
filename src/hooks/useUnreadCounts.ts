// hooks/useUnreadCounts.ts
import { useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useUnreadCounts() {
  const { user, tenant, unreadCounts, setUnreadCount } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!user?.id || !tenant?.id) return

    // Load channel_last_read rows for this user, count unread per channel
    supabase
      .from('channel_last_read')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id)
      .then(async ({ data: readRows }) => {
        const readMap: Record<string, string> = {}
        for (const r of readRows ?? []) readMap[r.channel_id] = r.last_read_at

        const { data: chans } = await supabase
          .from('channels')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('is_archived', false)

        for (const ch of chans ?? []) {
          const lastRead = readMap[ch.id]
          let q = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .eq('deleted', false)
            .is('thread_of', null)
          if (lastRead) q = q.gt('created_at', lastRead)
          const { count } = await q
          setUnreadCount(ch.id, count ?? 0)
        }
      })
  }, [user?.id, tenant?.id])

  const markRead = useCallback(async (channelId: string) => {
    if (!user?.id) return
    setUnreadCount(channelId, 0)
    await supabase.from('channel_last_read').upsert({
      user_id: user.id,
      channel_id: channelId,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,channel_id' })
  }, [user?.id])

  return { unreadCounts, markRead }
}

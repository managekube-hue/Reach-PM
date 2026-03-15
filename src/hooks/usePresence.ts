// hooks/usePresence.ts
// Spec 5.3 — heartbeat every 30s, subscribe to online users
// C-02: workspace_id, C-12: workspaceId from store
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const { user, workspaceId } = useReachStore()
  const supabase = createBrowserClient()

  // Heartbeat: upsert comm_presence row every 30 seconds
  useEffect(() => {
    if (!user?.id || !workspaceId) return

    const upsertPresence = () =>
      supabase.from('comm_presence').upsert(
        {
          user_id: user.id,
          workspace_id: workspaceId,
          status: 'online',
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'user_id,workspace_id' }
      )

    upsertPresence()
    const interval = setInterval(upsertPresence, 30_000)

    return () => {
      clearInterval(interval)
      // Mark offline on unmount
      supabase
        .from('comm_presence')
        .update({ status: 'offline' })
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
    }
  }, [user?.id, workspaceId])

  // Load initially-online users (seen in last 5 min)
  useEffect(() => {
    if (!workspaceId) return
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    supabase
      .from('comm_presence')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'online')
      .gte('last_seen', since)
      .then(({ data }) => {
        setOnlineUsers(new Set(data?.map((p: any) => p.user_id) ?? []))
      })

    // Realtime: watch presence changes
    const sub = supabase
      .channel(`presence:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comm_presence',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = (payload.new as any) || (payload.old as any)
          if (!row?.user_id) return
          setOnlineUsers((prev) => {
            const next = new Set(prev)
            if (row.status === 'online') next.add(row.user_id)
            else next.delete(row.user_id)
            return next
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [workspaceId])

  const isOnline = useCallback(
    (userId: string) => onlineUsers.has(userId),
    [onlineUsers]
  )

  return { isOnline }
}

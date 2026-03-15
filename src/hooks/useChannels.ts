// hooks/useChannels.ts
// C-02: workspace_id instead of tenant_id
// C-12: workspaceId from store instead of tenant?.id
import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import type { CommChannel } from '@/types'

export function useChannels() {
  const { workspaceId, v3Channels, setV3Channels } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!workspaceId) return

    supabase
      .from('channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_dm', false)
      .eq('is_archived', false)
      .order('name')
      .then(({ data }) => setV3Channels(data ?? []))

    const sub = supabase
      .channel(`channels:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const ch = payload.new as CommChannel
            if (!ch.is_dm && !ch.is_archived)
              setV3Channels([...useReachStore.getState().v3Channels, ch])
          }
          if (payload.eventType === 'UPDATE') {
            setV3Channels(
              useReachStore
                .getState()
                .v3Channels.map((c) =>
                  c.id === payload.new.id ? { ...c, ...payload.new } : c
                )
            )
          }
          if (payload.eventType === 'DELETE') {
            setV3Channels(
              useReachStore
                .getState()
                .v3Channels.filter((c) => c.id !== (payload.old as any).id)
            )
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [workspaceId])

  return v3Channels
}

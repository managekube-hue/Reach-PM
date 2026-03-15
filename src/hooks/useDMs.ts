// hooks/useDMs.ts
// Spec 5.5 — DM channels (is_dm=true, members contains user.id)
// C-02: workspace_id, C-12: workspaceId from store
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import type { CommChannel } from '@/types'

export function useDMs() {
  const [dmChannels, setDmChannels] = useState<CommChannel[]>([])
  const { user, workspaceId } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!workspaceId || !user?.id) return

    supabase
      .from('channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_dm', true)
      .contains('members', [user.id])
      .then(({ data }) => setDmChannels(data ?? []))

    const sub = supabase
      .channel(`dms:${workspaceId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const ch = payload.new as CommChannel
          if (ch.is_dm && ch.members?.includes(user.id)) {
            setDmChannels((prev) => [...prev, ch])
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [workspaceId, user?.id])

  const openDM = useCallback(
    async (targetUserId: string) => {
      if (!workspaceId || !user?.id) return

      // Check if DM channel already exists for these two users
      const { data: existing } = await supabase
        .from('channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_dm', true)
        .contains('members', [user.id, targetUserId])
        .maybeSingle()

      if (existing) {
        useReachStore.getState().setActiveChannel(existing.id)
        return
      }

      // Create new DM channel
      const { data: newDM } = await supabase
        .from('channels')
        .insert({
          workspace_id: workspaceId,
          name: [user.id, targetUserId].sort().join(':'),
          is_dm: true,
          members: [user.id, targetUserId],
          created_by: user.id,
        })
        .select()
        .single()

      if (newDM) {
        setDmChannels((prev) => [...prev, newDM])
        useReachStore.getState().setActiveChannel(newDM.id)
      }
    },
    [workspaceId, user?.id]
  )

  return { dmChannels, openDM }
}

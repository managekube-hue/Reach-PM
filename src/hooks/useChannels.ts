// hooks/useChannels.ts
import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useChannels() {
  const { tenant, channels, setChannels } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!tenant?.id) return
    supabase.from('channels').select('*')
      .eq('tenant_id', tenant.id).eq('is_dm', false)
      .eq('is_archived', false).order('name')
      .then(({ data }) => setChannels(data ?? []))

    const sub = supabase
      .channel(`channels:${tenant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'channels',
        filter: `tenant_id=eq.${tenant.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const ch = payload.new as any
          if (!ch.is_dm && !ch.is_archived)
            setChannels([...useReachStore.getState().channels, ch])
        }
        if (payload.eventType === 'UPDATE') {
          setChannels(useReachStore.getState().channels.map(c =>
            c.id === payload.new.id ? { ...c, ...payload.new } : c
          ))
        }
        if (payload.eventType === 'DELETE') {
          setChannels(useReachStore.getState().channels.filter(c =>
            c.id !== (payload.old as any).id
          ))
        }
      }).subscribe()

    return () => supabase.removeChannel(sub)
  }, [tenant?.id])

  return channels
}


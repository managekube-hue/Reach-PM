// hooks/useDMs.ts
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useDMs() {
  const [dmChannels, setDmChannels] = useState<any[]>([])
  const { tenant, user } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!tenant?.id || !user?.id) return

    supabase
      .from('channels')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_dm', true)
      .contains('members', [user.id])
      .then(({ data }) => setDmChannels(data ?? []))

    const sub = supabase
      .channel(`dms:${tenant.id}:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channels',
        filter: `tenant_id=eq.${tenant.id}`,
      }, (payload) => {
        const ch = payload.new as any
        if (ch.is_dm && Array.isArray(ch.members) && ch.members.includes(user.id))
          setDmChannels(prev => [...prev, ch])
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [tenant?.id, user?.id])

  const openDM = useCallback(async (targetUserId: string) => {
    if (!tenant?.id || !user?.id) return
    // Find existing DM channel between these two users
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('is_dm', true)
      .contains('members', [user.id, targetUserId])
      .maybeSingle()

    if (existing) {
      useReachStore.getState().setActiveChannel(existing.id)
      return
    }

    // Create new DM channel
    const { data: created } = await supabase
      .from('channels')
      .insert({
        tenant_id: tenant.id,
        name: 'dm',
        is_dm: true,
        members: [user.id, targetUserId],
        created_by: user.id,
      })
      .select('id')
      .single()

    if (created) useReachStore.getState().setActiveChannel(created.id)
  }, [tenant?.id, user?.id])

  return { dmChannels, openDM }
}


  return { dmChannels, openDM }
}

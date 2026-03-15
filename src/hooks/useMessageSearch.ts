// hooks/useMessageSearch.ts
import { useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useMessageSearch() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { tenant } = useReachStore()
  const supabase = createBrowserClient()

  const search = useCallback(async (query: string, channelId?: string) => {
    if (!query.trim() || !tenant?.id) return
    setLoading(true)
    let q = supabase
      .from('messages')
      .select(`*, author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color),
        channel:channels(id,name)`)
      .eq('tenant_id', tenant.id)
      .eq('deleted', false)
      .textSearch('body', query, { type: 'websearch' })
      .order('created_at', { ascending: false })
      .limit(50)
    if (channelId) q = q.eq('channel_id', channelId)
    const { data } = await q
    setResults(data ?? [])
    setLoading(false)
  }, [tenant?.id])

  return { results, loading, search }
}

// hooks/useMessageSearch.ts
// Spec Part 5.8 — C-02: workspace_id, C-12: workspaceId from store
import { useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import type { CommMessage } from '@/types'

export function useMessageSearch() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { workspaceId } = useReachStore() // C-12
  const supabase = createBrowserClient()

  const search = useCallback(
    async (query: string, channelId?: string) => {
      if (!query.trim() || !workspaceId) return // C-12
      setLoading(true)
      let q = supabase
        .from('messages')
        .select(
          `*, author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color),
           channel:channels(id,name)`
        )
        .eq('workspace_id', workspaceId) // C-02
        .eq('deleted', false)
        .textSearch('body', query, { type: 'websearch' })
        .order('created_at', { ascending: false })
        .limit(50)
      if (channelId) q = q.eq('channel_id', channelId)
      const { data } = await q
      setResults(data ?? [])
      setLoading(false)
    },
    [workspaceId]
  )

  return { results, loading, search }
}

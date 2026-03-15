// hooks/useThreadMessages.ts
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useThreadMessages(parentId: string | null) {
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!parentId) return
    setLoading(true); setReplies([])

    supabase.from('messages')
      .select(`*, author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color)`)
      .eq('thread_of', parentId)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setReplies(data ?? []); setLoading(false) })

    const sub = supabase
      .channel(`thread:${parentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public',
        table: 'messages', filter: `thread_of=eq.${parentId}` },
        async (payload) => {
          const { data } = await supabase.from('messages')
            .select(`*, author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color)`)
            .eq('id', payload.new.id).single()
          if (data) setReplies(prev => [...prev, data])
        })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [parentId])

  const sendReply = useCallback(async (body: string) => {
    if (!parentId || !body.trim()) return
    // channel_id and tenant_id are copied from parent by the t_copy_parent trigger
    await supabase.from('messages').insert({
      thread_of: parentId, body: body.trim(),
      mentions: extractMentionIds(body), is_system: false,
    })
  }, [parentId])

  return { replies, loading, sendReply }
}

function extractMentionIds(body: string): string[] {
  return [...body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2])
}

}

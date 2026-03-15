// hooks/useThreadMessages.ts
// Exact spec Part 5.7 with store import path fixed
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import type { CommMessage } from '@/types'

const REPLY_SELECT =
  `*, author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color)`

export function useThreadMessages(parentId: string | null) {
  const [replies, setReplies] = useState<CommMessage[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!parentId) return
    setLoading(true)
    setReplies([])

    supabase
      .from('messages')
      .select(REPLY_SELECT)
      .eq('thread_of', parentId)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setReplies(data ?? [])
        setLoading(false)
      })

    const sub = supabase
      .channel(`thread:${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_of=eq.${parentId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(REPLY_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (data) setReplies((prev) => [...prev, data as CommMessage])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [parentId])

  const sendReply = useCallback(
    async (body: string) => {
      if (!parentId || !body.trim()) return
      await supabase.from('messages').insert({
        thread_of: parentId,
        body: body.trim(),
        mentions: extractMentionIds(body),
        is_system: false,
        // channel_id + workspace_id copied from parent by DB trigger copy_parent_fields
      })
    },
    [parentId]
  )

  return { replies, loading, sendReply }
}

function extractMentionIds(body: string): string[] {
  return [...body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => m[2])
}

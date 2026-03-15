// hooks/useChat.ts
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

const MSG_SELECT = `
  *,
  author:profiles!messages_author_id_fkey(id,display_name,avatar_url,color),
  issue:issues(id,title,status,priority,assignee_id,
    assignee:profiles!issues_assignee_id_fkey(id,display_name,color))`

export function useChat(channelId: string | null) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const { user, issues } = useReachStore()
  const supabase = createBrowserClient()

  // Initial load
  useEffect(() => {
    if (!channelId) return
    setLoading(true); setMessages([])
    supabase.from('messages').select(MSG_SELECT)
      .eq('channel_id', channelId)
      .eq('deleted', false)
      .is('thread_of', null)
      .order('created_at', { ascending: true }).limit(100)
      .then(({ data }) => { setMessages(data ?? []); setLoading(false) })
  }, [channelId])

  // Realtime
  useEffect(() => {
    if (!channelId) return
    const sub = supabase
      .channel(`chat:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public',
        table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          if (payload.new.thread_of) return
          const { data } = await supabase.from('messages')
            .select(MSG_SELECT).eq('id', payload.new.id).single()
          if (data) setMessages(prev => [...prev, data])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public',
        table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages(prev => prev
            .filter(m => !payload.new.deleted || m.id !== payload.new.id)
            .map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
          )
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [channelId])

  const send = useCallback(async (body: string, attachments: any[] = [], linkPreview: any = null) => {
    if (!channelId || !body.trim()) return
    setSending(true)
    await supabase.from('messages').insert({
      channel_id: channelId, body: body.trim(),
      mentions: extractMentionIds(body),
      is_system: false,
      attachments,
      link_preview: linkPreview,
    })
    setSending(false)
  }, [channelId])

  const dropIssue = useCallback(async (issueId: string) => {
    if (!channelId) return
    const issue = (issues as any)[issueId]
    if (!issue) return
    await supabase.from('messages').insert({
      channel_id: channelId,
      body: `Issue ${issue.title} dropped into channel`,
      is_system: true, issue_id: issueId,
    })
  }, [channelId, issues])

  const editMessage = useCallback(async (id: string, body: string) => {
    await supabase.from('messages')
      .update({ body: body.trim() }).eq('id', id).eq('author_id', user?.id)
  }, [user?.id])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('messages')
      .update({ deleted: true }).eq('id', id).eq('author_id', user?.id)
  }, [user?.id])

  const addReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!user?.id) return
    const { data: msg } = await supabase.from('messages')
      .select('reactions').eq('id', msgId).single()
    if (!msg) return
    const r = msg.reactions || {}
    const users: string[] = r[emoji] || []
    const updated = users.includes(user.id) ? users.filter((id: string) => id !== user.id) : [...users, user.id]
    await supabase.from('messages')
      .update({ reactions: { ...r, [emoji]: updated } }).eq('id', msgId)
  }, [user?.id])

  const pinMessage = useCallback(async (msgId: string) => {
    if (!channelId) return
    await supabase.from('pinned_messages').insert({
      tenant_id: user?.tenant_id, channel_id: channelId,
      message_id: msgId, pinned_by: user?.id,
    })
  }, [channelId, user])

  return { messages, loading, sending, send, dropIssue,
    editMessage, deleteMessage, addReaction, pinMessage }
}

function extractMentionIds(body: string): string[] {
  return [...body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2])
}



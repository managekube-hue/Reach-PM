// components/chat/PinnedMessagesBar.tsx
// Spec Part 10.1 — exact spec, store import path fixed
import { useEffect, useState } from 'react'
import { Pin, X } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

export function PinnedMessagesBar({ channelId }: { channelId: string }) {
  const [pinned, setPinned] = useState<any[]>([])
  const supabase = createBrowserClient()

  useEffect(() => {
    const fetchPinned = () =>
      supabase
        .from('pinned_messages')
        .select(
          `*, message:messages(id,body,author:profiles!messages_author_id_fkey(display_name))`
        )
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .then(({ data }) => setPinned(data ?? []))

    fetchPinned()

    const sub = supabase
      .channel(`pinned:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pinned_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        fetchPinned
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [channelId])

  async function unpin(pinnedId: string) {
    await supabase.from('pinned_messages').delete().eq('id', pinnedId)
  }

  if (pinned.length === 0) return null

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/60">
      {pinned.map((p) => (
        <div key={p.id} className="flex items-center gap-2 px-4 py-2">
          <Pin size={11} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-zinc-400 font-medium mr-1">
              {p.message?.author?.display_name}:
            </span>
            <span className="text-xs text-zinc-300 truncate">
              {p.message?.body}
            </span>
          </div>
          <button
            onClick={() => unpin(p.id)}
            className="text-zinc-600 hover:text-red-400 flex-shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}

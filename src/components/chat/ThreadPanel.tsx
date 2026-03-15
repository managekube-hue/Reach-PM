// components/chat/ThreadPanel.tsx
// Spec Part 7.1 — exact spec, store import path fixed
import { useRef, useEffect, useState } from 'react'
import { X, Send } from 'lucide-react'
import { useThreadMessages } from '@/hooks/useThreadMessages'
import { useReachStore } from '@/store/useReachStore'

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ThreadPanel({ parentId }: { parentId: string }) {
  const { replies, loading, sendReply } = useThreadMessages(parentId)
  const { setActiveThread } = useReachStore()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  async function handleSend() {
    if (!body.trim() || sending) return
    setSending(true)
    await sendReply(body)
    setBody('')
    setSending(false)
  }

  return (
    <div className="w-80 flex flex-col border-l border-zinc-800 bg-[#16213E] flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-semibold text-white text-sm">Thread</span>
        <button
          onClick={() => setActiveThread(null)}
          className="text-zinc-400 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <p className="text-center text-zinc-500 text-xs py-4">Loading...</p>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center
                justify-center text-xs font-bold text-white"
              style={{ backgroundColor: reply.author?.color ?? '#48B8FF' }}
            >
              {(reply.author?.display_name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-white">
                  {reply.author?.display_name}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {timeAgo(reply.created_at)}
                </span>
              </div>
              <p className="text-xs text-zinc-200 break-words">{reply.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Reply in thread..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
            text-xs text-white placeholder-zinc-500 focus:outline-none
            focus:border-[#48B8FF]"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="p-2 text-[#48B8FF] hover:text-white disabled:text-zinc-600"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}

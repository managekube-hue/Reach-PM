// components/chat/MessagePanel.tsx
// Spec Part 6.2 — exact spec, store import path fixed
import { useRef, useEffect, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { useReachStore } from '@/store/useReachStore'
import { MessageBubble } from './MessageBubble'
import { InlineIssueCard } from './InlineIssueCard'
import { MessageInput } from './MessageInput'
import { PinnedMessagesBar } from './PinnedMessagesBar'
import { StartMeetingButton } from '@/components/video/StartMeetingButton'
import { Pin } from 'lucide-react'

export function MessagePanel({ channelId }: { channelId: string }) {
  const {
    messages,
    loading,
    sending,
    send,
    dropIssue,
    editMessage,
    deleteMessage,
    addReaction,
    pinMessage,
  } = useChat(channelId)
  const { setActiveThread } = useReachStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showPinned, setShowPinned] = useState(false)

  // Listen for drag-drop issue events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail.channelId === channelId) dropIssue(e.detail.issueId)
    }
    window.addEventListener('reach:drop-issue', handler as EventListener)
    return () =>
      window.removeEventListener('reach:drop-issue', handler as EventListener)
  }, [channelId, dropIssue])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Channel header */}
      <div className="flex items-center justify-between px-4 py-3
        border-b border-zinc-800 flex-shrink-0 gap-2">
        <span className="font-semibold text-white text-sm">Channel</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPinned((p) => !p)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white
              px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <Pin size={12} /> Pinned
          </button>
          <StartMeetingButton channelId={channelId} />
        </div>
      </div>

      {showPinned && <PinnedMessagesBar channelId={channelId} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && (
          <p className="text-center text-zinc-500 text-sm py-8">Loading...</p>
        )}
        {messages.map((msg) =>
          msg.is_system && msg.issue_id ? (
            <InlineIssueCard
              key={msg.id}
              message={msg}
              onReact={(emoji) => addReaction(msg.id, emoji)}
            />
          ) : (
            <MessageBubble
              key={msg.id}
              message={msg}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onReact={(emoji) => addReaction(msg.id, emoji)}
              onPin={() => pinMessage(msg.id)}
              onThread={() => setActiveThread(msg.id)}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={send} sending={sending} channelId={channelId} />
    </div>
  )
}

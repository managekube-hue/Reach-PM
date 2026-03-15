// components/chat/MessageBubble.tsx
// Spec Part 6.3 — exact spec, store import path fixed
import { useState } from 'react'
function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
import { Edit2, Trash2, Pin, MessageSquare } from 'lucide-react'
import { useReachStore } from '@/store/useReachStore'
import type { CommMessage } from '@/types'

const QUICK = ['👍', '❤️', '😂', '🎉', '🚀', '👀']

interface Props {
  message: CommMessage
  onEdit: (id: string, body: string) => void
  onDelete: (id: string) => void
  onPin: () => void
  onThread: () => void
}

export function MessageBubble({
  message,
  onEdit,
  onDelete,
  onPin,
  onThread,
}: Props) {
  const { user } = useReachStore()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(message.body)
  const isOwn = message.sender_user_id === user?.id

  if (message.deleted_at) {
    return (
      <div className="pl-11 py-0.5 text-zinc-600 italic text-sm">
        [This message was deleted]
      </div>
    )
  }

  function renderBody(body: string) {
    return body.replace(
      /@\[([^\]]+)\]\([^)]+\)/g,
      (_, name) => `<span class="text-[#48B8FF] font-medium">@${name}</span>`
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className="group flex gap-3 px-2 py-1 rounded-md hover:bg-zinc-800/40 relative"
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
          text-sm font-bold text-white"
        style={{ backgroundColor: message.sender?.color ?? '#48B8FF' }}
      >
        {(message.sender?.display_name ?? '?')[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-semibold text-sm text-white">
            {message.sender?.display_name}
          </span>
          <span className="text-xs text-zinc-500">
            {timeAgo(message.created_at)}
          </span>
          {message.edited_at && (
            <span className="text-xs text-zinc-600">(edited)</span>
          )}
        </div>

        {/* Body / Edit input */}
        {editing ? (
          <div className="flex gap-2">
            <input
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onEdit(message.id, editBody)
                  setEditing(false)
                }
                if (e.key === 'Escape') {
                  setEditing(false)
                  setEditBody(message.body)
                }
              }}
              className="flex-1 bg-zinc-700 rounded px-2 py-1 text-sm text-white
                border border-[#48B8FF] outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setEditing(false)
                setEditBody(message.body)
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <p
            className="text-sm text-zinc-200 break-words"
            dangerouslySetInnerHTML={{ __html: renderBody(message.body) }}
          />
        )}

        {/* Link preview — removed (not in comm_messages schema) */}

        {/* Attachments */}
        {(message.attachments ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800
                  border border-zinc-700 hover:border-[#48B8FF] transition-colors text-sm"
              >
                {att.type?.startsWith('image/') && att.thumbnail_url ? (
                  <img
                    src={att.thumbnail_url}
                    alt={att.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <span className="text-zinc-400">📎</span>
                )}
                <div>
                  <p className="text-xs text-white truncate max-w-[120px]">
                    {att.name}
                  </p>
                  <p className="text-xs text-zinc-500">{formatBytes(att.size)}</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Reactions — removed (not persisted in comm_messages) */}

        {/* Thread replies count — hidden (thread_count not in comm_messages schema) */}
      </div>

      {/* Hover actions */}
      <div
        className="absolute right-2 top-1 opacity-0 group-hover:opacity-100
          flex items-center gap-1 bg-zinc-800 border border-zinc-700
          rounded-md px-1 py-0.5 shadow-lg"
      >
        <button
          onClick={onThread}
          className="p-1 text-zinc-400 hover:text-white"
          title="Reply in thread"
        >
          <MessageSquare size={11} />
        </button>
        <button
          onClick={onPin}
          className="p-1 text-zinc-400 hover:text-yellow-400"
          title="Pin message"
        >
          <Pin size={11} />
        </button>
        {isOwn && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 text-zinc-400 hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1_048_576).toFixed(1) + ' MB'
}

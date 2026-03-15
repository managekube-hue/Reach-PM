// components/chat/ChannelList.tsx
// Derived from spec Parts 6.1, 7.1, 7.2 — channel sidebar with drag-drop support
import type { CommChannel } from '@/types'
import { Hash, Lock, Users, Search, MessageSquare } from 'lucide-react'

interface Props {
  channels: CommChannel[]
  dmChannels: CommChannel[]
  activeChannelId: string | null
  unreadCounts: Record<string, number>
  isOnline: (userId: string) => boolean
  onSelect: (channelId: string) => void
  onOpenDM: (userId: string) => void
  onOpenSearch: () => void
}

export function ChannelList({
  channels,
  dmChannels,
  activeChannelId,
  unreadCounts,
  isOnline,
  onSelect,
  onOpenDM,
  onOpenSearch,
}: Props) {
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: React.DragEvent, channelId: string) {
    e.preventDefault()
    const issueId = e.dataTransfer.getData('issueId')
    if (issueId) {
      window.dispatchEvent(
        new CustomEvent('reach:drop-issue', {
          detail: { issueId, channelId },
        })
      )
    }
  }

  return (
    <div className="w-56 flex flex-col bg-[#12122A] border-r border-zinc-800 flex-shrink-0">
      {/* Search button */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 mx-3 mt-3 mb-2 px-3 py-2 rounded-lg
          bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-400
          hover:border-[#48B8FF] hover:text-white transition-colors"
      >
        <Search size={12} />
        Search...
      </button>

      {/* Public channels */}
      <div className="px-3 mb-1">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest py-1">
          Channels
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {channels.map((ch) => {
          const unread = unreadCounts[ch.id] ?? 0
          const isActive = ch.id === activeChannelId
          return (
            <div
              key={ch.id}
              draggable={false}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, ch.id)}
              onClick={() => onSelect(ch.id)}
              className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none
                transition-colors rounded-sm mx-1
                ${isActive
                  ? 'bg-[#48B8FF]/20 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
            >
              {ch.is_private ? (
                <Lock size={12} className="flex-shrink-0" />
              ) : (
                <Hash size={12} className="flex-shrink-0" />
              )}
              <span className="text-xs truncate flex-1">{ch.name}</span>
              {unread > 0 && (
                <span className="ml-auto text-[10px] bg-[#48B8FF] text-black font-bold
                  rounded-full px-1.5 min-w-[18px] text-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          )
        })}

        {/* DMs section */}
        {dmChannels.length > 0 && (
          <>
            <div className="px-3 mt-3 mb-1">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                Direct Messages
              </p>
            </div>
            {dmChannels.map((dm) => {
              const unread = unreadCounts[dm.id] ?? 0
              const isActive = dm.id === activeChannelId
              // DM name is userId1:userId2 — show truncated
              const displayName = dm.name?.split(':').slice(-1)[0]?.slice(0, 8) ?? 'DM'
              return (
                <div
                  key={dm.id}
                  onClick={() => onSelect(dm.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none
                    transition-colors rounded-sm mx-1
                    ${isActive
                      ? 'bg-[#48B8FF]/20 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                    }`}
                >
                  <Users size={12} className="flex-shrink-0" />
                  <span className="text-xs truncate flex-1">{displayName}</span>
                  {unread > 0 && (
                    <span className="ml-auto text-[10px] bg-[#48B8FF] text-black font-bold
                      rounded-full px-1.5 min-w-[18px] text-center">
                      {unread}
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// components/chat/ChatLayout.tsx
// Spec Part 6.1 — C-12: workspaceId instead of tenant, C-02 applied
import { useState } from 'react'
import { useChannels } from '@/hooks/useChannels'
import { useUnreadCounts } from '@/hooks/useUnreadCounts'
import { usePresence } from '@/hooks/usePresence'
import { useDMs } from '@/hooks/useDMs'
import { useReachStore } from '@/store/useReachStore'
import { ChannelList } from './ChannelList'
import { MessagePanel } from './MessagePanel'
import { ThreadPanel } from './ThreadPanel'
import { IssuesSidebar } from './IssuesSidebar'
import { SearchOverlay } from './SearchOverlay'

export function ChatLayout() {
  const channels = useChannels()
  const { unreadCounts, markRead } = useUnreadCounts()
  const { isOnline } = usePresence()
  const { dmChannels, openDM } = useDMs()
  const { activeChannelId, setActiveChannel, activeThread, workspaceId } =
    useReachStore() // C-12: workspaceId instead of tenant
  const [searchOpen, setSearchOpen] = useState(false)

  if (!workspaceId) return <FullScreenSpinner /> // C-12

  function handleSelect(channelId: string) {
    setActiveChannel(channelId)
    markRead(channelId)
  }

  return (
    <div className="flex h-screen bg-[#1A1A2E] text-white overflow-hidden">
      <ChannelList
        channels={channels}
        dmChannels={dmChannels}
        activeChannelId={activeChannelId}
        unreadCounts={unreadCounts}
        isOnline={isOnline}
        onSelect={handleSelect}
        onOpenDM={openDM}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="flex-1 flex min-w-0">
        {activeChannelId ? (
          <MessagePanel channelId={activeChannelId} />
        ) : (
          <EmptyState />
        )}
        {activeThread && <ThreadPanel parentId={activeThread} />}
      </div>
      <IssuesSidebar />
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  )
}

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#1A1A2E]">
      <div className="w-6 h-6 border-2 border-[#48B8FF] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-zinc-500">
      <p className="text-sm">Select a channel to start messaging</p>
    </div>
  )
}

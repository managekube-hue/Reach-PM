// components/chat/ChannelList.tsx
// Spec Parts 6.1, 7.1, 7.2 — channel sidebar with create channel + new DM + real names
import { useState, useEffect } from 'react'
import type { CommChannel } from '@/types'
import { Hash, Lock, Users, Search, Plus, X } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

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
  const { workspaceId, user } = useReachStore()
  const supabase = createBrowserClient()

  // ── Create channel modal ────────────────────────────────────────
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [channelError, setChannelError] = useState('')

  async function createChannel() {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!name || !workspaceId || !user?.id) return
    setCreatingChannel(true)
    setChannelError('')
    const { error } = await supabase.rpc('comm_create_channel', {
      p_workspace_id: workspaceId,
      p_name: name,
      p_is_private: newChannelPrivate,
    })
    setCreatingChannel(false)
    if (error) { setChannelError(error.message); return }
    setNewChannelName('')
    setNewChannelPrivate(false)
    setShowNewChannel(false)
  }

  // ── New DM modal ────────────────────────────────────────────────
  const [showNewDM, setShowNewDM] = useState(false)
  const [dmSearch, setDmSearch] = useState('')
  const [dmUsers, setDmUsers] = useState<any[]>([])
  const [dmSearching, setDmSearching] = useState(false)

  useEffect(() => {
    if (!showNewDM || !workspaceId) return
    setDmSearching(true)
    supabase
      .from('profiles')
      .select('id,display_name,avatar_url,color')
      .eq('default_workspace_id', workspaceId)
      .neq('id', user?.id ?? '')
      .ilike('display_name', `%${dmSearch}%`)
      .limit(20)
      .then(({ data }) => { setDmUsers(data ?? []); setDmSearching(false) })
  }, [dmSearch, showNewDM, workspaceId])

  // ── DM display name lookup via comm_conversation_members ─────────
  const [dmNames, setDmNames] = useState<Record<string, string>>({})
  const [dmOtherIds, setDmOtherIds] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!dmChannels.length || !user?.id) return
    const missing = dmChannels.filter((dm) => !dmNames[dm.id])
    if (!missing.length) return
    const missingIds = missing.map((dm) => dm.id)
    // Get the OTHER member from comm_conversation_members
    supabase
      .from('comm_conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', missingIds)
      .neq('user_id', user.id)
      .then(({ data: members }) => {
        if (!members?.length) return
        const otherMap: Record<string, string> = {}
        members.forEach((m: any) => { otherMap[m.conversation_id] = m.user_id })
        const otherUserIds = [...new Set(Object.values(otherMap))]
        supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', otherUserIds)
          .then(({ data: profiles }) => {
            if (!profiles) return
            const nameMap: Record<string, string> = { ...dmNames }
            const idMap: Record<string, string> = { ...dmOtherIds }
            missing.forEach((dm) => {
              const otherId = otherMap[dm.id]
              const profile = profiles.find((p: any) => p.id === otherId)
              nameMap[dm.id] = profile?.display_name ?? 'Unknown'
              if (otherId) idMap[dm.id] = otherId
            })
            setDmNames(nameMap)
            setDmOtherIds(idMap)
          })
      })
  }, [dmChannels, user?.id])

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
    <div className="w-56 flex flex-col bg-[#12122A] border-r border-zinc-800 flex-shrink-0 relative">
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

      {/* Public channels header */}
      <div className="px-3 mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest py-1">
          Channels
        </p>
        <button
          onClick={() => setShowNewChannel(true)}
          className="text-zinc-500 hover:text-[#48B8FF] transition-colors p-0.5 rounded"
          title="New channel"
        >
          <Plus size={12} />
        </button>
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
        <div className="px-3 mt-3 mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Direct Messages
          </p>
          <button
            onClick={() => setShowNewDM(true)}
            className="text-zinc-500 hover:text-[#48B8FF] transition-colors p-0.5 rounded"
            title="New DM"
          >
            <Plus size={12} />
          </button>
        </div>
        {dmChannels.map((dm) => {
          const unread = unreadCounts[dm.id] ?? 0
          const isActive = dm.id === activeChannelId
          const displayName = dmNames[dm.id] ?? '…'
          const otherId = dmOtherIds[dm.id]
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
              <div className="relative flex-shrink-0">
                <Users size={12} />
                {otherId && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#12122A]
                    ${isOnline(otherId) ? 'bg-green-400' : 'bg-zinc-600'}`} />
                )}
              </div>
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
      </div>

      {/* ── New Channel Modal ─────────────────────────────────── */}
      {showNewChannel && (
        <div className="absolute inset-0 z-50 bg-[#12122A]/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white">New Channel</span>
            <button onClick={() => { setShowNewChannel(false); setChannelError('') }}
              className="text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
          <input
            autoFocus
            value={newChannelName}
            onChange={e => setNewChannelName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createChannel()}
            placeholder="channel-name"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700
              text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#48B8FF] mb-3"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-400 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={newChannelPrivate}
              onChange={e => setNewChannelPrivate(e.target.checked)}
              className="rounded"
            />
            Private channel
          </label>
          {channelError && (
            <p className="text-xs text-red-400 mb-3">{channelError}</p>
          )}
          <button
            onClick={createChannel}
            disabled={creatingChannel || !newChannelName.trim()}
            className="w-full py-2 rounded-lg bg-[#48B8FF] text-black text-xs font-semibold
              hover:bg-[#60c8ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creatingChannel ? 'Creating…' : 'Create Channel'}
          </button>
        </div>
      )}

      {/* ── New DM Modal ──────────────────────────────────────── */}
      {showNewDM && (
        <div className="absolute inset-0 z-50 bg-[#12122A]/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">New Direct Message</span>
            <button onClick={() => { setShowNewDM(false); setDmSearch('') }}
              className="text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
          <input
            autoFocus
            value={dmSearch}
            onChange={e => setDmSearch(e.target.value)}
            placeholder="Search teammates…"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700
              text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#48B8FF] mb-2"
          />
          <div className="flex-1 overflow-y-auto space-y-1">
            {dmSearching && (
              <p className="text-xs text-zinc-500 text-center py-4">Searching…</p>
            )}
            {!dmSearching && dmUsers.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No teammates found</p>
            )}
            {dmUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onOpenDM(u.id)
                  setShowNewDM(false)
                  setDmSearch('')
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg
                  hover:bg-zinc-800 text-left transition-colors"
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                    style={{ background: u.color ?? '#48B8FF' }}>
                    {(u.display_name ?? '?')[0].toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#12122A]
                    ${isOnline(u.id) ? 'bg-green-400' : 'bg-zinc-600'}`} />
                </div>
                <span className="text-xs text-zinc-300 truncate">{u.display_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

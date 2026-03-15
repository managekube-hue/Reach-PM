// components/chat/SearchOverlay.tsx
// Spec Part 8.1 — exact spec, store import path fixed
import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useMessageSearch } from '@/hooks/useMessageSearch'
import { useReachStore } from '@/store/useReachStore'
import { formatDistanceToNow } from 'date-fns'

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { results, loading, search } = useMessageSearch()
  const { setActiveChannel } = useReachStore()

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.length >= 2) search(query)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function jumpTo(msg: any) {
    setActiveChannel(msg.channel_id)
    onClose()
    setTimeout(() => {
      document.getElementById(`msg-${msg.id}`)?.scrollIntoView({
        behavior: 'smooth',
      })
    }, 300)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-24">
      <div
        className="w-full max-w-xl bg-[#16213E] rounded-2xl border border-zinc-700
          shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700">
          <Search size={16} className="text-zinc-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-white text-sm
              placeholder-zinc-500 outline-none"
          />
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800">
          {loading && (
            <p className="text-center text-zinc-500 text-sm py-6">
              Searching...
            </p>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-zinc-500 text-sm py-6">No results</p>
          )}
          {results.map((msg) => (
            <button
              key={msg.id}
              onClick={() => jumpTo(msg)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-[#48B8FF]">
                  #{msg.channel?.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatDistanceToNow(new Date(msg.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-medium">
                {msg.author?.display_name}
              </p>
              <p className="text-sm text-zinc-200 line-clamp-2 mt-0.5">
                {msg.body}
              </p>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            Press Esc to close &nbsp;·&nbsp; Cmd+K to open search
          </p>
        </div>
      </div>
    </div>
  )
}

// components/video/StartMeetingButton.tsx
// Pass 5 / spec Part 20.3 — full implementation with Zoom dropdown
import { useState, useRef, useEffect } from 'react'
import { Video, ExternalLink, ChevronDown } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import { VideoRoom } from './VideoRoom'

interface MeetingData {
  room_code: string
  meeting_id: string
}

export function StartMeetingButton({ channelId }: { channelId: string }) {
  const [loading, setLoading] = useState(false)
  const [zoomLoading, setZoomLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()
  const { user } = useReachStore()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function startNative() {
    setLoading(true)
    setMenuOpen(false)
    try {
      const { data } = await supabase.functions.invoke('create-meeting', {
        body: { channel_id: channelId, title: 'Standup' },
      })
      if (data?.room_code) {
        setMeetingData({ room_code: data.room_code, meeting_id: data.meeting_id })
      }
    } finally {
      setLoading(false)
    }
  }

  async function startZoom() {
    setZoomLoading(true)
    setMenuOpen(false)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token ?? ''
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-create-meeting`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ channel_id: channelId, title: 'Standup' }),
        }
      )
      const data = await res.json()
      if (data?.join_url) window.open(data.join_url, '_blank', 'noopener,noreferrer')
    } finally {
      setZoomLoading(false)
    }
  }

  if (meetingData) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        <VideoRoom
          roomCode={meetingData.room_code}
          meetingId={meetingData.meeting_id}
          onLeave={() => setMeetingData(null)}
        />
      </div>
    )
  }

  // Not Zoom connected — single button
  if (!user?.zoom_connected) {
    return (
      <button
        onClick={startNative}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white
          px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        title="Start video meeting"
      >
        <Video size={12} />
        {loading ? 'Starting...' : 'Meet'}
      </button>
    )
  }

  // Zoom connected — split button
  return (
    <div className="relative flex items-center" ref={menuRef}>
      <button
        onClick={startNative}
        disabled={loading || zoomLoading}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white
          px-2 py-1 rounded-l bg-zinc-800 hover:bg-zinc-700 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed border-r border-zinc-700"
        title="Start REACH native meeting"
      >
        <Video size={12} />
        {loading ? 'Starting...' : 'Start Standup'}
      </button>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        disabled={loading || zoomLoading}
        className="flex items-center px-1 py-1 rounded-r bg-zinc-800 hover:bg-zinc-700
          text-zinc-400 hover:text-white transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        title="More options"
      >
        <ChevronDown size={12} />
      </button>
      {menuOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-800 border border-zinc-700
          rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={startNative}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300
              hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <Video size={12} />
            REACH Video (native)
          </button>
          <button
            onClick={startZoom}
            disabled={zoomLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300
              hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <ExternalLink size={12} />
            {zoomLoading ? 'Launching...' : 'Start Zoom Meeting'}
          </button>
        </div>
      )}
    </div>
  )
}

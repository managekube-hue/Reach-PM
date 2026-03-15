// components/video/StartMeetingButton.tsx
// Stub for Pass 1 — full implementation in Pass 5 (WebRTC)
// Creates a meeting via Edge Function and navigates to the meeting room
import { useState } from 'react'
import { Video } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

export function StartMeetingButton({ channelId }: { channelId: string }) {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleStart() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-meeting', {
        body: { channel_id: channelId, title: 'Standup' },
      })
      if (data?.room_code) {
        window.location.href = `/meeting/${data.room_code}`
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleStart}
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

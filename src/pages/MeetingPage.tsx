// pages/MeetingPage.tsx
// Spec Part 10.4 — meeting page: lookup room → name prompt (guests) → VideoRoom
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createBrowserClient } from '@/lib/supabase'
import { VideoRoom } from '@/components/video/VideoRoom'

type Meeting = {
  id: string
  room_code: string
  status: 'scheduled' | 'active' | 'ended'
  title: string | null
}

export default function MeetingPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joined, setJoined] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    if (!roomCode) return
    const supabase = createBrowserClient()
    supabase
      .from('meetings')
      .select('id,room_code,status,title')
      .eq('room_code', roomCode)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else { setMeeting(data) }
        setLoading(false)
      })
  }, [roomCode])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080809', color: '#9898A8', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
        Loading meeting…
      </div>
    )
  }

  if (notFound || !meeting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080809', color: '#EEEEF2', fontFamily: "'DM Mono', monospace", gap: 12 }}>
        <span style={{ fontSize: 40 }}>🔍</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Meeting not found</span>
        <span style={{ fontSize: 13, color: '#9898A8' }}>Room code <code style={{ color: '#3ECFCF' }}>{roomCode}</code> does not exist.</span>
      </div>
    )
  }

  if (meeting.status === 'ended') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080809', color: '#EEEEF2', fontFamily: "'DM Mono', monospace", gap: 12 }}>
        <span style={{ fontSize: 40 }}>📵</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Meeting ended</span>
        <span style={{ fontSize: 13, color: '#9898A8' }}>This meeting has already concluded.</span>
      </div>
    )
  }

  if (joined) {
    return (
      <VideoRoom
        roomCode={meeting.room_code}
        meetingId={meeting.id}
        onLeave={() => setJoined(false)}
      />
    )
  }

  // Name prompt (handles both authed users and guests)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080809', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ background: '#0E0E10', border: '1px solid #222226', borderRadius: 12, padding: '32px 40px', width: 400, maxWidth: '92vw' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📹</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#EEEEF2', marginBottom: 4 }}>
            {meeting.title ?? 'Team Meeting'}
          </div>
          <div style={{ fontSize: 12, color: '#9898A8' }}>Room: <span style={{ color: '#3ECFCF' }}>{roomCode}</span></div>
        </div>
        <label style={{ display: 'block', fontSize: 11, color: '#9898A8', marginBottom: 6, fontWeight: 500, letterSpacing: '0.04em' }}>
          YOUR NAME
        </label>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) { setGuestName(nameInput.trim()); setJoined(true) } }}
          placeholder="Enter your name to join…"
          style={{ width: '100%', background: '#141416', border: '1px solid #222226', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#EEEEF2', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box', marginBottom: 16, outline: 'none' }}
          autoFocus
        />
        <button
          onClick={() => { if (nameInput.trim()) { setGuestName(nameInput.trim()); setJoined(true) } }}
          disabled={!nameInput.trim()}
          style={{ width: '100%', background: '#3ECFCF', color: '#080809', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: nameInput.trim() ? 'pointer' : 'not-allowed', opacity: nameInput.trim() ? 1 : 0.5, fontFamily: "'DM Mono', monospace" }}
        >
          Join Meeting
        </button>
      </div>
    </div>
  )
}

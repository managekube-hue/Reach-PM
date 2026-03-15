// pages/StandupsPage.tsx
// Live meetings/standups page — loads meetings from DB, allows join/start
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

type Meeting = {
  id: string
  title: string
  description: string | null
  room_code: string
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  host_id: string | null
  recording_url: string | null
}

function fmtDateTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_COLOR: Record<string, string> = {
  live:      '#3EC98E',
  scheduled: '#3ECFCF',
  ended:     '#54545E',
  cancelled: '#F26B6B',
}

export default function StandupsPage() {
  const navigate = useNavigate()
  const { workspaceId, user } = useReachStore()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    const supabase = createBrowserClient()

    supabase
      .from('meetings')
      .select('id,title,description,room_code,status,scheduled_at,started_at,ended_at,host_id,recording_url')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMeetings(data as Meeting[])
        setLoading(false)
      })

    // Realtime: watch for status changes (live / ended)
    const sub = supabase
      .channel(`meetings:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        const updated = payload.new as Meeting
        setMeetings(prev => {
          const idx = prev.findIndex(m => m.id === updated.id)
          if (idx === -1) return [updated, ...prev]
          const next = [...prev]
          next[idx] = updated
          return next
        })
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [workspaceId])

  async function startMeeting() {
    if (!workspaceId || !user?.id || !newTitle.trim()) return
    setCreating(true)
    const supabase = createBrowserClient()
    const roomCode = Math.random().toString(36).slice(2, 10)
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        workspace_id: workspaceId,
        title: newTitle.trim(),
        room_code: roomCode,
        status: 'live',
        host_id: user.id,
        started_at: new Date().toISOString(),
      })
      .select('room_code')
      .single()
    setCreating(false)
    if (!error && data) {
      setShowForm(false)
      setNewTitle('')
      navigate(`/meeting/${data.room_code}`)
    }
  }

  const liveMeetings = meetings.filter(m => m.status === 'live')
  const upcoming    = meetings.filter(m => m.status === 'scheduled')
  const past        = meetings.filter(m => m.status === 'ended' || m.status === 'cancelled')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#080809', color: '#EEEEF2',
      fontFamily: "'DM Mono', monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1E1E22',
        background: '#0E0E10',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Video Standups
          </div>
          <div style={{ fontSize: 11, color: '#54545E', marginTop: 2 }}>
            {liveMeetings.length > 0
              ? `${liveMeetings.length} meeting${liveMeetings.length > 1 ? 's' : ''} live now`
              : 'No active meetings'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: '#3ECFCF', color: '#080809', border: 'none',
            cursor: 'pointer', fontFamily: "'DM Mono', monospace",
          }}
        >
          + New Meeting
        </button>
      </div>

      {/* New meeting form */}
      {showForm && (
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid #1E1E22',
          background: '#0E0E10', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startMeeting()}
            placeholder="Meeting title…"
            style={{
              flex: 1, background: '#1A1A1D', border: '1px solid #2E2E34',
              borderRadius: 6, padding: '7px 11px', fontSize: 12,
              color: '#EEEEF2', fontFamily: "'DM Mono', monospace", outline: 'none',
            }}
            autoFocus
          />
          <button
            onClick={startMeeting}
            disabled={creating || !newTitle.trim()}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: '#3ECFCF', color: '#080809', border: 'none',
              cursor: creating || !newTitle.trim() ? 'not-allowed' : 'pointer',
              opacity: creating || !newTitle.trim() ? 0.6 : 1,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {creating ? 'Starting…' : 'Start Now'}
          </button>
          <button
            onClick={() => setShowForm(false)}
            style={{
              padding: '7px 11px', borderRadius: 6, fontSize: 12,
              background: 'transparent', border: '1px solid #2E2E34',
              color: '#9898A8', cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#54545E', fontSize: 12 }}>
            Loading meetings…
          </div>
        ) : (
          <>
            {/* Live now */}
            {liveMeetings.length > 0 && (
              <Section title="Live Now" accent="#3EC98E">
                {liveMeetings.map(m => <MeetingCard key={m.id} meeting={m} onJoin={() => navigate(`/meeting/${m.room_code}`)} />)}
              </Section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Section title="Scheduled" accent="#3ECFCF">
                {upcoming.map(m => <MeetingCard key={m.id} meeting={m} onJoin={() => navigate(`/meeting/${m.room_code}`)} />)}
              </Section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <Section title="Past Meetings" accent="#54545E">
                {past.map(m => <MeetingCard key={m.id} meeting={m} onJoin={undefined} />)}
              </Section>
            )}

            {meetings.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', paddingTop: 80, gap: 12, color: '#54545E',
              }}>
                <span style={{ fontSize: 48 }}>📹</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>No meetings yet</span>
                <span style={{ fontSize: 12 }}>Click "New Meeting" to start a standup</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: accent, marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function MeetingCard({ meeting, onJoin }: { meeting: Meeting; onJoin?: () => void }) {
  const statusColor = STATUS_COLOR[meeting.status] ?? '#54545E'
  return (
    <div style={{
      background: '#0E0E10', border: '1px solid #1E1E22', borderRadius: 10,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0,
        boxShadow: meeting.status === 'live' ? `0 0 8px ${statusColor}` : 'none',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{meeting.title}</div>
        {meeting.description && (
          <div style={{ fontSize: 11, color: '#9898A8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meeting.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#54545E' }}>
          {meeting.scheduled_at && <span>Scheduled: {fmtDateTime(meeting.scheduled_at)}</span>}
          {meeting.started_at && <span>Started: {fmtDateTime(meeting.started_at)}</span>}
          {meeting.ended_at && <span>Ended: {fmtDateTime(meeting.ended_at)}</span>}
          <span style={{ color: statusColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {meeting.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {meeting.recording_url && (
          <a
            href={meeting.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              background: 'transparent', border: '1px solid #2E2E34',
              color: '#9898A8', cursor: 'pointer', textDecoration: 'none',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            ▶ Recording
          </a>
        )}
        {onJoin && (meeting.status === 'live' || meeting.status === 'scheduled') && (
          <button
            onClick={onJoin}
            style={{
              padding: '5px 14px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              background: meeting.status === 'live' ? '#3EC98E' : '#3ECFCF',
              color: '#080809', border: 'none', cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {meeting.status === 'live' ? 'Join Now' : 'Enter Room'}
          </button>
        )}
      </div>
    </div>
  )
}

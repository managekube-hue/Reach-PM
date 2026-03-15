// pages/InboxPage.tsx
// Live notifications inbox backed by the notifications table (workspace_id, user_id, read)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { useReachStore } from '@/store/useReachStore'

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  mention:         { label: 'Mention',           color: '#8B7CF8', icon: '@' },
  dm:              { label: 'Direct Message',    color: '#3ECFCF', icon: '✉' },
  issue_assigned:  { label: 'Issue Assigned',    color: '#3EC98E', icon: '◎' },
  video_start:     { label: 'Meeting Started',   color: '#E8965A', icon: '▶' },
  thread_reply:    { label: 'Thread Reply',       color: '#5BA4F5', icon: '↩' },
  reaction:        { label: 'Reaction',           color: '#E8C25A', icon: '✦' },
  system:          { label: 'System',             color: '#54545E', icon: '⚙' },
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function InboxPage() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const { user } = useReachStore()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const visible = filter === 'unread'
    ? notifications.filter((n: any) => !n.read)
    : notifications

  function handleClick(n: any) {
    if (!n.read) markRead(n.id)
    if (n.link) {
      // Internal or external link
      if (n.link.startsWith('/')) navigate(n.link)
      else window.open(n.link, '_blank', 'noopener,noreferrer')
    } else if (n.payload?.conversation_id) {
      navigate('/chat')
    }
  }

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
            Inbox
          </div>
          <div style={{ fontSize: 11, color: '#54545E', marginTop: 2 }}>
            {user?.display_name ?? user?.email ?? 'You'} · {unreadCount} unread
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                background: filter === f ? '#3ECFCF' : '#1A1A1D',
                color: filter === f ? '#080809' : '#9898A8',
              }}
            >
              {f === 'all' ? 'All' : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              background: 'transparent', border: '1px solid #2E2E34',
              color: '#9898A8', cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 10, color: '#54545E',
          }}>
            <span style={{ fontSize: 36 }}>✓</span>
            <span style={{ fontSize: 13 }}>
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </span>
          </div>
        ) : (
          visible.map((n: any) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.system
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', gap: 14, padding: '14px 24px',
                  borderBottom: '1px solid #1A1A1D',
                  background: n.read ? 'transparent' : 'rgba(62,207,207,0.04)',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0E0E10')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(62,207,207,0.04)')}
              >
                {/* Type icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: meta.color + '18',
                  border: `1px solid ${meta.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: meta.color, marginTop: 2,
                }}>
                  {meta.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</span>
                    {!n.read && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#3ECFCF', flexShrink: 0,
                      }} />
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#54545E', flexShrink: 0 }}>
                      {fmtTime(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: 11, color: '#9898A8', lineHeight: 1.55,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {n.body}
                    </div>
                  )}
                  <span style={{
                    display: 'inline-block', marginTop: 5,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: meta.color,
                    background: meta.color + '14', padding: '1px 6px', borderRadius: 3,
                  }}>
                    {meta.label}
                  </span>
                </div>

                {/* Mark read button */}
                {!n.read && (
                  <button
                    onClick={e => { e.stopPropagation(); markRead(n.id) }}
                    title="Mark as read"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#54545E', fontSize: 16, padding: '0 4px', flexShrink: 0,
                      alignSelf: 'flex-start',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

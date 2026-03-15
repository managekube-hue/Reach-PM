// components/notifications/NotificationBell.tsx
// Pass 3 — Full bell + dropdown, uses dismiss / dismissAll from useNotifications
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { Bell } from 'lucide-react'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_ICON: Record<string, string> = {
  mention: '💬',
  dm: '✉️',
  issue_assigned: '🎯',
  meeting_start: '📹',
  message: '🔔',
}

export function NotificationBell() {
  const { notifications, unreadCount, dismiss, dismissAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: '1px solid #222226',
          borderRadius: 6,
          padding: 5,
          cursor: 'pointer',
          color: '#9898A8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: '0.12s',
        }}
        title="Notifications"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 6, height: 6, borderRadius: '50%',
            background: '#F26B6B', border: '1.5px solid #080809',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, background: '#0E0E10',
          border: '1px solid #222226', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 300, overflow: 'hidden',
          animation: 'fadeUp 0.15s ease',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #222226' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EEEEF2', fontFamily: "'DM Mono', monospace" }}>
              Notifications {unreadCount > 0 && <span style={{ background: '#F26B6B', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 10, marginLeft: 4 }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={dismissAll} style={{ fontSize: 10, color: '#9898A8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 14px', textAlign: 'center', color: '#54545E', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                No notifications
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex', gap: 10, padding: '10px 14px',
                    background: n.read ? 'transparent' : 'rgba(62,207,207,0.05)',
                    borderBottom: '1px solid #141416',
                    cursor: 'pointer', transition: '0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#141416')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(62,207,207,0.05)')}
                  onClick={() => dismiss(n.id)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>
                    {TYPE_ICON[n.type] ?? '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#EEEEF2', fontWeight: n.read ? 400 : 600, lineHeight: 1.4, fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>
                      {n.title ?? n.body ?? 'New notification'}
                    </div>
                    {n.body && n.title && (
                      <div style={{ fontSize: 11, color: '#9898A8', lineHeight: 1.4, fontFamily: "'DM Mono', monospace" }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#54545E', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                      {n.created_at ? timeAgo(n.created_at) : ''}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ECFCF', marginTop: 6, flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

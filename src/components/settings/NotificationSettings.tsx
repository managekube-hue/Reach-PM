// components/settings/NotificationSettings.tsx
// Spec Part 25 — notification preferences per user
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import { requestNotificationPermission } from '@/lib/push'

const NOTIFY_TYPES = [
  { key: 'mention',           label: '@ Mentions' },
  { key: 'dm',                label: 'Direct Messages' },
  { key: 'issue_assigned',    label: 'Issue Assignments' },
  { key: 'video_start',       label: 'Video Standup Start' },
  { key: 'standup_reminder',  label: 'Daily Standup Reminder' },
]

type Prefs = {
  notification_email: boolean
  notification_browser: boolean
  notification_sounds: boolean
  notification_types: string[]
}

export function NotificationSettings() {
  const { user } = useReachStore()
  const supabase = createBrowserClient()
  const [prefs, setPrefs] = useState<Prefs>({
    notification_email: true,
    notification_browser: true,
    notification_sounds: true,
    notification_types: ['mention', 'dm', 'issue_assigned', 'video_start'],
  })

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles')
      .select('notification_email,notification_browser,notification_sounds,notification_types')
      .eq('id', user.id).single()
      .then(({ data }) => { if (data) setPrefs(data as Prefs) })
  }, [user?.id])

  async function save(delta: Partial<Prefs>) {
    const next = { ...prefs, ...delta }
    setPrefs(next)
    await supabase.from('profiles').update(next).eq('id', user?.id)
    // Persist sound pref locally for instant access without DB
    localStorage.setItem('reach:sounds', String(next.notification_sounds))
    // Request browser notification permission when user enables it
    if (delta.notification_browser) {
      await requestNotificationPermission()
    }
  }

  return (
    <div className="space-y-5 max-w-md">
      <h3 className="text-white font-semibold">Notification Preferences</h3>
      {[
        { key: 'notification_email',   label: 'Email notifications',    desc: 'Emails for mentions and DMs' },
        { key: 'notification_browser', label: 'Browser notifications',  desc: 'Desktop alerts when app is in background' },
        { key: 'notification_sounds',  label: 'Notification sounds',    desc: 'Chimes for messages and mentions' },
      ].map(item => (
        <label key={item.key} className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
          </div>
          <input type="checkbox"
            checked={(prefs as any)[item.key]}
            onChange={e => save({ [item.key]: e.target.checked } as any)}
            className="mt-1 accent-[#48B8FF] scale-125"
          />
        </label>
      ))}
      <div className="pt-2 border-t border-zinc-800">
        <p className="text-sm font-medium text-white mb-2">Notify me about</p>
        {NOTIFY_TYPES.map(t => (
          <label key={t.key} className="flex items-center gap-2 py-1 cursor-pointer">
            <input type="checkbox"
              checked={prefs.notification_types?.includes(t.key)}
              onChange={e => {
                const types = e.target.checked
                  ? [...(prefs.notification_types ?? []), t.key]
                  : (prefs.notification_types ?? []).filter(x => x !== t.key)
                save({ notification_types: types })
              }}
              className="accent-[#48B8FF]"
            />
            <span className="text-sm text-zinc-300">{t.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// lib/push.ts
// Pass 3 — Browser Push Notification API wrappers
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showBrowserNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string; onClick?: () => void }
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null
  const n = new Notification(title, {
    body: options?.body,
    icon: options?.icon ?? '/favicon.ico',
    tag: options?.tag,
  })
  if (options?.onClick) n.onclick = () => { window.focus(); options.onClick!() }
  return n
}

// lib/signal.ts
// Spec Part 8.4 — sendSignal and subscribeToSignals via webrtc_signals table
// C-14: webrtc_signals has RLS disabled so all peers can read/write
import { createBrowserClient } from '@/lib/supabase'

export async function sendSignal(
  roomCode: string,
  fromUser: string,
  type: string,
  payload: object,
  toUser?: string
) {
  const supabase = createBrowserClient()
  await supabase.from('webrtc_signals').insert({
    room_code: roomCode,
    from_user: fromUser,
    to_user: toUser ?? null,
    type,
    payload,
  })
}

export function subscribeToSignals(
  roomCode: string,
  onSignal: (signal: any) => void
) {
  const supabase = createBrowserClient()
  const sub = supabase
    .channel(`signals:${roomCode}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'webrtc_signals',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => onSignal(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(sub)
}

// lib/webrtc.ts
// Spec Part 8.3 — ICE config loader via supabase.functions.invoke
// C-08: createBrowserClient() returns existing singleton
import { createBrowserClient } from '@/lib/supabase'

export async function getIceServers(): Promise<RTCIceServer[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase.functions.invoke('get-ice-servers')
  if (error || !data?.iceServers) {
    console.warn('TURN fetch failed, falling back to STUN only')
    return [{ urls: 'stun:stun.l.google.com:19302' }]
  }
  return data.iceServers
}

export async function createPeerConnection(): Promise<RTCPeerConnection> {
  const iceServers = await getIceServers()
  return new RTCPeerConnection({
    iceServers,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  })
}

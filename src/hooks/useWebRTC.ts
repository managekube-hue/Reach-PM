// hooks/useWebRTC.ts
// Spec Part 10.1 — full mesh P2P via Supabase Realtime signaling
// Replaces WebSocket-based signaling from v2.0
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPeerConnection } from '@/lib/webrtc'
import { sendSignal, subscribeToSignals } from '@/lib/signal'
import { useReachStore } from '@/store/useReachStore'

interface Peer {
  userId: string
  displayName: string
  stream: MediaStream | null
  pc: RTCPeerConnection
}

export function useWebRTC(roomCode: string | null) {
  const { user } = useReachStore()
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [camEnabled, setCamEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const peersRef = useRef<Record<string, Peer>>({})
  const localStreamRef = useRef<MediaStream | null>(null)

  // ── Join the room ──────────────────────────────────────────────────
  const join = useCallback(async () => {
    if (!roomCode || !user?.id) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      setError('Camera/mic access denied. Please allow access and try again.')
      return
    }
    localStreamRef.current = stream
    setLocalStream(stream)

    const unsub = subscribeToSignals(roomCode, handleSignal)
    await sendSignal(roomCode, user.id, 'join', {
      display_name: user.display_name ?? user.email,
    })
    setJoined(true)
    return unsub
  }, [roomCode, user?.id])

  // ── Handle incoming signals ──────────────────────────────────────
  async function handleSignal(signal: any) {
    if (signal.from_user === user?.id) return
    if (signal.to_user && signal.to_user !== user?.id) return
    const fromId = signal.from_user

    switch (signal.type) {
      case 'join': {
        const pc = await createPeerConnection()
        setupPC(pc, fromId)
        localStreamRef.current?.getTracks().forEach((t) =>
          pc.addTrack(t, localStreamRef.current!)
        )
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal(roomCode!, user!.id, 'offer', { sdp: offer }, fromId)
        addPeer(fromId, signal.payload.display_name, pc)
        break
      }
      case 'offer': {
        let pc = peersRef.current[fromId]?.pc
        if (!pc) {
          pc = await createPeerConnection()
          setupPC(pc, fromId)
          localStreamRef.current?.getTracks().forEach((t) =>
            pc!.addTrack(t, localStreamRef.current!)
          )
          addPeer(fromId, 'Participant', pc)
        }
        await pc.setRemoteDescription(
          new RTCSessionDescription(signal.payload.sdp)
        )
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal(roomCode!, user!.id, 'answer', { sdp: answer }, fromId)
        break
      }
      case 'answer': {
        const pc = peersRef.current[fromId]?.pc
        if (pc)
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.payload.sdp)
          )
        break
      }
      case 'ice-candidate': {
        const pc = peersRef.current[fromId]?.pc
        if (pc && signal.payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate))
        }
        break
      }
      case 'leave': {
        cleanupPeer(fromId)
        break
      }
    }
  }

  // ── PC event handlers ────────────────────────────────────────────
  function setupPC(pc: RTCPeerConnection, peerId: string) {
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await sendSignal(
          roomCode!,
          user!.id,
          'ice-candidate',
          { candidate: e.candidate },
          peerId
        )
      }
    }
    pc.ontrack = (e) => {
      const stream = e.streams[0]
      setPeers((prev) => ({ ...prev, [peerId]: { ...prev[peerId], stream } }))
      peersRef.current[peerId] = { ...peersRef.current[peerId], stream }
    }
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        cleanupPeer(peerId)
      }
    }
  }

  function addPeer(userId: string, displayName: string, pc: RTCPeerConnection) {
    const peer: Peer = { userId, displayName, stream: null, pc }
    peersRef.current[userId] = peer
    setPeers((prev) => ({ ...prev, [userId]: peer }))
  }

  function cleanupPeer(userId: string) {
    peersRef.current[userId]?.pc.close()
    const updated = { ...peersRef.current }
    delete updated[userId]
    peersRef.current = updated
    setPeers({ ...updated })
  }

  // ── Leave room ───────────────────────────────────────────────────
  const leave = useCallback(async () => {
    if (roomCode && user?.id) await sendSignal(roomCode, user.id, 'leave', {})
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    Object.values(peersRef.current).forEach((p) => p.pc.close())
    peersRef.current = {}
    setPeers({})
    setLocalStream(null)
    setJoined(false)
  }, [roomCode, user?.id])

  // ── Media toggles ────────────────────────────────────────────────
  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setCamEnabled((prev) => !prev)
  }, [])

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setMicEnabled((prev) => !prev)
  }, [])

  return {
    localStream,
    peers: Object.values(peers),
    joined,
    error,
    camEnabled,
    micEnabled,
    join,
    leave,
    toggleCam,
    toggleMic,
  }
}

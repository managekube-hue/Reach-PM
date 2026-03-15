// components/video/VideoRoom.tsx
// Spec Part 10.2 — full mesh P2P video room
// Includes MeetingIssueOverlay (spec Part 12.3)
import { useEffect, useRef } from 'react'
import { useWebRTC } from '@/hooks/useWebRTC'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import { RecordingControls } from './RecordingControls'
import { MeetingIssueOverlay } from './MeetingIssueOverlay'

interface Props {
  roomCode: string
  meetingId: string
  onLeave: () => void
}

export function VideoRoom({ roomCode, meetingId, onLeave }: Props) {
  const {
    localStream,
    peers,
    joined,
    error,
    camEnabled,
    micEnabled,
    join,
    leave,
    toggleCam,
    toggleMic,
  } = useWebRTC(roomCode)

  useEffect(() => {
    let unsub: (() => void) | undefined
    join().then((fn) => {
      unsub = fn
    })
    return () => unsub?.()
  }, [roomCode])

  async function handleLeave() {
    await leave()
    onLeave()
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-zinc-700 rounded text-white text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 relative">
      {/* Video grid */}
      <div
        className="flex-1 grid gap-2 p-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(peers.length + 1, 3)}, 1fr)`,
        }}
      >
        {/* Local video */}
        <VideoTile stream={localStream} label="You (me)" muted />

        {/* Remote peers */}
        {peers.map((peer) => (
          <VideoTile
            key={peer.userId}
            stream={peer.stream}
            label={peer.displayName}
          />
        ))}

        {!joined && (
          <div
            className="col-span-full flex items-center justify-center h-48
              bg-zinc-800 rounded-xl text-zinc-500 text-sm"
          >
            Connecting...
          </div>
        )}
      </div>

      {/* Meeting issue overlay (Part 12.3) */}
      <MeetingIssueOverlay meetingId={meetingId} />

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-6">
        <button
          onClick={toggleCam}
          className={`p-3 rounded-full transition-colors ${
            camEnabled
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-colors ${
            micEnabled
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <RecordingControls localStream={localStream} meetingId={meetingId} />
        <button
          onClick={handleLeave}
          className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  )
}

function VideoTile({
  stream,
  label,
  muted = false,
}: {
  stream: MediaStream | null
  label: string
  muted?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative bg-zinc-800 rounded-xl overflow-hidden aspect-video">
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
          {label}
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-md">
        {label}
      </div>
    </div>
  )
}

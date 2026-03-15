// components/video/RecordingControls.tsx
// Spec Part 11.1 — MediaRecorder → Supabase Storage
// C-13: profiles.default_workspace_id not tenant_id
import { useState, useRef } from 'react'
import { Circle, StopCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

interface Props {
  localStream: MediaStream | null
  meetingId: string
}

export function RecordingControls({ localStream, meetingId }: Props) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  async function startRecording() {
    if (!localStream) return

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'

    const recorder = new MediaRecorder(localStream, { mimeType })
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      await uploadRecording()
    }

    recorder.start(1000) // collect chunks every second
    recorderRef.current = recorder
    setRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  async function uploadRecording() {
    if (chunksRef.current.length === 0) return
    setUploading(true)

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })

    // C-13: get default_workspace_id not tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_workspace_id')
      .eq('id', user?.id)
      .single()

    const path = `${profile?.default_workspace_id}/${meetingId}_${Date.now()}.webm`

    const { error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(path, blob, { contentType: 'video/webm', upsert: false })

    if (!uploadErr) {
      await supabase
        .from('meetings')
        .update({ recording_path: path })
        .eq('id', meetingId)
    }

    setUploading(false)
    chunksRef.current = []
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      disabled={uploading || !localStream}
      className={[
        'p-3 rounded-full transition-colors',
        recording
          ? 'bg-red-600 hover:bg-red-500 animate-pulse text-white'
          : 'bg-zinc-700 hover:bg-zinc-600 text-white',
        uploading ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      title={recording ? 'Stop recording' : 'Start recording'}
    >
      {uploading ? (
        <span className="text-xs">Saving...</span>
      ) : recording ? (
        <StopCircle size={18} />
      ) : (
        <Circle size={18} />
      )}
    </button>
  )
}

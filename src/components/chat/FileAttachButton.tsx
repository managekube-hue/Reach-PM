// components/chat/FileAttachButton.tsx
// Spec Part 9.2 — exact spec
import { useRef } from 'react'
import { Paperclip } from 'lucide-react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function FileAttachButton({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = '' // reset so same file can be picked again
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.webm,.mp3"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="p-1.5 text-zinc-400 hover:text-white transition-colors
          disabled:text-zinc-600 disabled:cursor-not-allowed"
        title="Attach file"
      >
        <Paperclip size={15} />
      </button>
    </>
  )
}

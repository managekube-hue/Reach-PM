// components/chat/MessageInput.tsx
// Spec Part 9.3 — C-01: link-preview via supabase.functions.invoke (not /api/link-preview)
// C-02: workspace_id, C-12: workspaceId from store
import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import { useFileUpload } from '@/hooks/useFileUpload'
import { FileAttachButton } from './FileAttachButton'

interface Props {
  onSend: (body: string, attachments: any[], linkPreview: any) => void
  sending: boolean
  channelId: string
}

export function MessageInput({ onSend, sending, channelId }: Props) {
  const [body, setBody] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [mentionStart, setMentionStart] = useState(-1)
  const [pendingFiles, setPendingFiles] = useState<any[]>([])
  const [linkPreview, setLinkPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const { workspaceId } = useReachStore() // C-12
  const supabase = createBrowserClient()
  const { upload, uploading } = useFileUpload()

  // Detect URLs and fetch preview via Edge Function (C-01)
  useEffect(() => {
    const urlMatch = body.match(/https?:\/\/[^\s]+/)
    if (urlMatch && !linkPreview) {
      setPreviewLoading(true)
      supabase.functions
        .invoke('link-preview', { body: { url: urlMatch[0] } })
        .then(({ data }) => {
          setLinkPreview(data ?? null)
          setPreviewLoading(false)
        })
        .catch(() => setPreviewLoading(false))
    }
    if (!urlMatch) setLinkPreview(null)
  }, [body])

  async function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setBody(val)
    const cursor = e.target.selectionStart ?? 0
    const match = val.slice(0, cursor).match(/@([\w.-]*)$/)
    if (match && match[1].length >= 1) {
      setMentionStart(cursor - match[0].length)
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name,color')
        .eq('default_workspace_id', workspaceId) // C-02
        .ilike('display_name', `%${match[1]}%`)
        .limit(5)
      setResults(data ?? [])
    } else {
      setResults([])
    }
  }

  function insertMention(p: any) {
    const cursor = ref.current?.selectionStart ?? 0
    const token = `@[${p.display_name}](${p.id}) `
    setBody(body.slice(0, mentionStart) + token + body.slice(cursor))
    setResults([])
    ref.current?.focus()
  }

  async function handleFiles(files: File[]) {
    const uploaded = await upload(files)
    setPendingFiles((prev) => [...prev, ...uploaded])
  }

  async function handleSend() {
    if ((!body.trim() && pendingFiles.length === 0) || sending || uploading)
      return
    await onSend(body, pendingFiles, linkPreview)
    setBody('')
    setPendingFiles([])
    setLinkPreview(null)
  }

  return (
    <div className="relative p-4 border-t border-zinc-800 flex-shrink-0">
      {/* Mention autocomplete */}
      {results.length > 0 && (
        <div
          className="absolute bottom-full left-4 right-4 mb-1 bg-zinc-800
            border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50"
        >
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => insertMention(p)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-700
                text-sm text-white text-left"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center
                  text-xs font-bold text-white"
                style={{ backgroundColor: p.color ?? '#48B8FF' }}
              >
                {p.display_name[0].toUpperCase()}
              </div>
              {p.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Pending attachments preview */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {pendingFiles.map((f, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2 bg-zinc-800 border
                border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300"
            >
              {f.type?.startsWith('image/') && f.thumbnail_url ? (
                <img
                  src={f.thumbnail_url}
                  className="w-8 h-8 object-cover rounded"
                  alt=""
                />
              ) : (
                <span>📎</span>
              )}
              <span className="truncate max-w-[100px]">{f.name}</span>
              <button
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-zinc-500 hover:text-red-400 ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link preview card */}
      {linkPreview && (
        <div
          className="mb-2 flex gap-3 border border-zinc-700 rounded-lg
            bg-zinc-800/60 overflow-hidden max-w-sm"
        >
          {linkPreview.image && (
            <img
              src={linkPreview.image}
              className="w-16 h-16 object-cover flex-shrink-0"
              alt=""
            />
          )}
          <div className="p-2 min-w-0">
            <p className="text-xs text-zinc-500 truncate">{linkPreview.domain}</p>
            <p className="text-sm font-medium text-white truncate">
              {linkPreview.title}
            </p>
          </div>
          <button
            onClick={() => setLinkPreview(null)}
            className="p-2 text-zinc-500 hover:text-white self-start"
          >
            ×
          </button>
        </div>
      )}

      {/* Input row */}
      <div
        className="flex items-end gap-2 bg-zinc-800 rounded-xl border
          border-zinc-700 focus-within:border-[#48B8FF] transition-colors px-3 py-2"
      >
        <FileAttachButton onFiles={handleFiles} disabled={uploading} />
        <textarea
          ref={ref}
          value={body}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Message... (@ to mention, Shift+Enter for newline)"
          rows={1}
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500
            outline-none resize-none max-h-32"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = t.scrollHeight + 'px'
          }}
        />
        {uploading && (
          <span className="text-xs text-zinc-500">Uploading...</span>
        )}
        <button
          onClick={handleSend}
          disabled={
            (!body.trim() && pendingFiles.length === 0) || sending || uploading
          }
          className="p-1 text-[#48B8FF] hover:text-white transition-colors
            disabled:text-zinc-600 disabled:cursor-not-allowed"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

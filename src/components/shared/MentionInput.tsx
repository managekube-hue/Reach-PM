// components/shared/MentionInput.tsx
// Spec Part 19.1 — universal @mention input, drop-in across all surfaces
import { useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

interface MentionInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  onSubmit?: () => void
  className?: string
  // The surface this is embedded in — for universal_mentions tracking
  surface?: 'chat' | 'issue_description' | 'issue_comment' | 'doc' | 'ide_note'
  resourceId?: string  // id of the containing resource
  link?: string        // navigation link for notification
}

export function MentionInput({
  value, onChange, placeholder, multiline, rows = 3,
  onSubmit, className = '', surface = 'chat', resourceId, link
}: MentionInputProps) {
  const [results, setResults] = useState<any[]>([])
  const [mentionStart, setMentionStart] = useState(-1)
  const ref = useRef<any>(null)
  const { tenant } = useReachStore()
  const supabase = createBrowserClient()

  async function handleChange(e: React.ChangeEvent<any>) {
    const val = e.target.value
    onChange(val)
    const cursor = e.target.selectionStart ?? 0
    const match = val.slice(0, cursor).match(/@([\w.-]*)$/)
    if (match && match[1].length >= 1) {
      setMentionStart(cursor - match[0].length)
      const { data } = await supabase.from('profiles')
        .select('id,display_name,color')
        .eq('tenant_id', tenant?.id)
        .ilike('display_name', `%${match[1]}%`)
        .limit(5)
      setResults(data ?? [])
    } else { setResults([]) }
  }

  function insertMention(p: any) {
    const cursor = ref.current?.selectionStart ?? 0
    const token = `@[${p.display_name}](${p.id}) `
    onChange(value.slice(0, mentionStart) + token + value.slice(cursor))
    setResults([])
    ref.current?.focus()

    // Write to universal_mentions if we have context
    // Chat mentions are handled by DB trigger; other surfaces write here
    if (surface !== 'chat' && resourceId) {
      supabase.from('universal_mentions').insert({
        mentioned_user_id: p.id,
        surface, resource_id: resourceId,
        context_text: value.slice(0, 120),
        link: link ?? '',
      }).then(() => {})
    }
  }

  const Tag = multiline ? 'textarea' : 'input'
  const baseClass = `w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2
    text-sm text-white placeholder-zinc-500 focus:outline-none
    focus:border-[#48B8FF] transition-colors ${className}`

  return (
    <div className="relative">
      {results.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-zinc-700
          rounded-xl shadow-xl overflow-hidden z-50 min-w-48">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => insertMention(p)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-700 text-sm text-white text-left">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center
                justify-center text-xs font-bold text-white"
                style={{ backgroundColor: p.color }}>
                {p.display_name[0].toUpperCase()}
              </div>
              {p.display_name}
            </button>
          ))}
        </div>
      )}
      <Tag
        ref={ref} value={value} onChange={handleChange}
        placeholder={placeholder ?? 'Type @ to mention...'}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter' && !e.shiftKey && onSubmit) { e.preventDefault(); onSubmit() }
        }}
        className={baseClass}
        rows={multiline ? rows : undefined}
      />
    </div>
  )
}

// Render @[name](id) as highlighted spans — safe HTML (no user content injected)
export function renderMentions(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g,
    (_, name) => `<span class="text-[#48B8FF] font-medium">@${name}</span>`)
}

// Extract user IDs from mention tokens
export function extractMentionIds(body: string): string[] {
  return [...body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2])
}

// components/chat/InlineIssueCard.tsx
// Derived from spec Part 7.3 (step 7-8): system message with issue_id renders this card
// 5 action buttons: View, Assign to me, Done, IDE, Docs
import { useReachStore } from '@/store/useReachStore'
import { createBrowserClient } from '@/lib/supabase'
import type { CommMessage } from '@/types'
import { ExternalLink, User, CheckSquare, Terminal, BookOpen } from 'lucide-react'

interface Props {
  message: CommMessage
  onReact: (emoji: string) => void
}

export function InlineIssueCard({ message, onReact }: Props) {
  const { user, updateIssue } = useReachStore()
  const supabase = createBrowserClient()
  const issue = (message as any).issue

  if (!issue) return null

  const statusColor: Record<string, string> = {
    todo: 'bg-zinc-600',
    in_progress: 'bg-blue-500',
    done: 'bg-green-500',
    blocked: 'bg-red-500',
  }

  async function assignToMe() {
    if (!user?.id) return
    await updateIssue(issue.id, { assignee_id: user.id })
    await supabase.from('issues').update({ assignee_id: user.id }).eq('id', issue.id)
  }

  async function markDone() {
    await updateIssue(issue.id, { status: 'done' })
    await supabase.from('issues').update({ status: 'done' }).eq('id', issue.id)
  }

  return (
    <div
      className="my-2 mx-2 rounded-xl border border-zinc-700 bg-zinc-800/60
        overflow-hidden max-w-md"
    >
      {/* Issue header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700/60">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[issue.status] ?? 'bg-zinc-600'}`}
        />
        <p className="text-sm font-medium text-white flex-1 truncate">
          {issue.title}
        </p>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
          {issue.priority ?? 'medium'}
        </span>
      </div>

      {/* Assignee */}
      {issue.assignee && (
        <div className="px-4 py-2 flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center
              text-[10px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: issue.assignee.color ?? '#48B8FF' }}
          >
            {issue.assignee.display_name[0].toUpperCase()}
          </div>
          <span className="text-xs text-zinc-400">{issue.assignee.display_name}</span>
        </div>
      )}

      {/* 5 Action buttons */}
      <div className="flex gap-1 px-4 pb-3 flex-wrap">
        <a
          href={`/board?issue=${issue.id}`}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded
            bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors"
        >
          <ExternalLink size={9} /> View
        </a>
        <button
          onClick={assignToMe}
          disabled={issue.assignee_id === user?.id}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded
            bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white
            transition-colors disabled:opacity-40"
        >
          <User size={9} /> Assign me
        </button>
        <button
          onClick={markDone}
          disabled={issue.status === 'done'}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded
            bg-zinc-700 hover:bg-green-700 text-zinc-300 hover:text-white
            transition-colors disabled:opacity-40"
        >
          <CheckSquare size={9} /> Done
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('reach:open-ide', { detail: { issueId: issue.id } })
            )
          }
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded
            bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors"
        >
          <Terminal size={9} /> IDE
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('reach:open-docs', { detail: { issueId: issue.id } })
            )
          }
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded
            bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors"
        >
          <BookOpen size={9} /> Docs
        </button>
      </div>
    </div>
  )
}

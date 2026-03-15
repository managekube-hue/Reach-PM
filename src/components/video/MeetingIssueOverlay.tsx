// components/video/MeetingIssueOverlay.tsx
// Spec Part 12.2 — C-17: updateIssue(id, updates) not updateIssue({ id, ...updates })
import { useState } from 'react'
import { useMeetingIssues } from '@/hooks/useMeetingIssues'
import { useReachStore } from '@/store/useReachStore'
import { CheckSquare, UserCheck, X, ChevronDown, ChevronUp } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

export function MeetingIssueOverlay({ meetingId }: { meetingId: string }) {
  const { droppedIssues, dropIssue, resolveIssue } = useMeetingIssues(meetingId)
  const { user, updateIssue } = useReachStore()
  const [collapsed, setCollapsed] = useState(false)
  const supabase = createBrowserClient()

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const issueId = e.dataTransfer.getData('issueId')
    if (issueId) dropIssue(issueId)
  }

  async function assignToMe(issueId: string) {
    await updateIssue(issueId, { assignee_id: user?.id }) // C-17
    await supabase.from('issues').update({ assignee_id: user?.id }).eq('id', issueId)
  }

  async function markDone(issueId: string, dropId: string) {
    await updateIssue(issueId, { status: 'done' }) // C-17
    await supabase.from('issues').update({ status: 'done' }).eq('id', issueId)
    await resolveIssue(dropId)
  }

  return (
    <div
      className="absolute bottom-20 left-4 w-72 bg-[#16213E]/95 backdrop-blur-sm
        border border-zinc-700 rounded-xl shadow-2xl z-40 overflow-hidden"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-zinc-700
          cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-xs font-semibold text-zinc-300">
          Issues in meeting ({droppedIssues.length})
        </span>
        {collapsed ? (
          <ChevronDown size={12} className="text-zinc-400" />
        ) : (
          <ChevronUp size={12} className="text-zinc-400" />
        )}
      </div>

      {!collapsed && (
        <>
          {droppedIssues.length === 0 && (
            <div className="px-3 py-4 text-center text-zinc-600 text-xs">
              Drag issues here to discuss
            </div>
          )}
          <div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto">
            {droppedIssues.map((drop) => (
              <div key={drop.id} className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">
                      {drop.issue?.title}
                    </p>
                    {drop.issue?.assignee && (
                      <p className="text-[10px] text-zinc-500">
                        Assigned: {drop.issue.assignee.display_name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => resolveIssue(drop.id)}
                    className="text-zinc-600 hover:text-zinc-400 flex-shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => assignToMe(drop.issue.id)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded
                      bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    <UserCheck size={9} /> Mine
                  </button>
                  <button
                    onClick={() => markDone(drop.issue.id, drop.id)}
                    disabled={drop.issue?.status === 'done'}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded
                      bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40"
                  >
                    <CheckSquare size={9} /> Done
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-zinc-700 text-[10px] text-zinc-600 text-center">
            Drop issues from sidebar to discuss
          </div>
        </>
      )}
    </div>
  )
}

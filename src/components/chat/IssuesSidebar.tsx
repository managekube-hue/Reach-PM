// components/chat/IssuesSidebar.tsx
// Spec Part 7.2 — exact spec, store import path fixed
import { useReachStore } from '@/store/useReachStore'

export function IssuesSidebar() {
  const { issues } = useReachStore()
  const active = Object.values(issues).filter((i: any) => i.status !== 'done')

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('issueId', id)
    e.dataTransfer.effectAllowed = 'copy'
    // Ghost drag image
    const ghost = document.createElement('div')
    ghost.textContent = (issues[id] as any)?.title ?? 'Issue'
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-100px',
      left: '-100px',
      background: '#16213E',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid #48B8FF',
      fontSize: '12px',
      maxWidth: '200px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    })
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  return (
    <div className="w-52 border-l border-zinc-800 bg-[#16213E] flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          Drag to channel
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {active.map((issue: any) => (
          <div
            key={issue.id}
            draggable
            onDragStart={(e) => onDragStart(e, issue.id)}
            className="p-2 rounded-md bg-zinc-800/60 border border-zinc-700
              cursor-grab active:cursor-grabbing hover:border-[#48B8FF]
              transition-colors select-none"
          >
            <p className="text-xs text-white line-clamp-2">{issue.title}</p>
          </div>
        ))}
        {active.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No active issues</p>
        )}
      </div>
    </div>
  )
}

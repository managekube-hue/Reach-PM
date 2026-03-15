// hooks/useMeetingIssues.ts
// Spec Part 12.1 — exact spec code with store import path fixed
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useMeetingIssues(meetingId: string | null) {
  const [droppedIssues, setDroppedIssues] = useState<any[]>([])
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!meetingId) return

    supabase
      .from('meeting_issue_drops')
      .select(
        `*,
         issue:issues(id,title,status,priority,assignee_id,
           assignee:profiles!issues_assignee_id_fkey(id,display_name,color))`
      )
      .eq('meeting_id', meetingId)
      .eq('resolved', false)
      .then(({ data }) => setDroppedIssues(data ?? []))

    const sub = supabase
      .channel(`meeting-issues:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_issue_drops',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async () => {
          const { data } = await supabase
            .from('meeting_issue_drops')
            .select(
              `*, issue:issues(id,title,status,priority,assignee_id,
                 assignee:profiles!issues_assignee_id_fkey(id,display_name,color))`
            )
            .eq('meeting_id', meetingId)
            .eq('resolved', false)
          setDroppedIssues(data ?? [])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [meetingId])

  const dropIssue = useCallback(
    async (issueId: string) => {
      if (!meetingId || !user?.id) return
      await supabase.from('meeting_issue_drops').insert({
        meeting_id: meetingId,
        issue_id: issueId,
        dropped_by: user.id,
      })
    },
    [meetingId, user?.id]
  )

  const resolveIssue = useCallback(async (dropId: string) => {
    await supabase
      .from('meeting_issue_drops')
      .update({ resolved: true })
      .eq('id', dropId)
  }, [])

  return { droppedIssues, dropIssue, resolveIssue }
}

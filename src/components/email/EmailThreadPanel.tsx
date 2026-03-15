// components/email/EmailThreadPanel.tsx
// Spec Part 18.4 — email thread linked to an issue
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'
import { formatDistanceToNow } from 'date-fns'
import { Send, RefreshCw } from 'lucide-react'

export function EmailThreadPanel({ issueId }: { issueId: string }) {
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [replyTo, setReplyTo] = useState<any>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  useEffect(() => { load() }, [issueId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('email_threads')
      .select('*').eq('issue_id', issueId)
      .order('provider_received_at', { ascending: true })
    setEmails(data ?? [])
    setLoading(false)
  }

  async function sync() {
    setSyncing(true)
    await supabase.functions.invoke('sync-emails', {
      body: { provider: 'google', issue_id: issueId }
    })
    await load()
    setSyncing(false)
  }

  async function sendReply() {
    if (!replyTo || !replyBody.trim() || sending) return
    setSending(true)
    await supabase.functions.invoke('send-email-reply', {
      body: {
        to: replyTo.from_email,
        subject: replyTo.subject,
        body: `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`,
        thread_id: replyTo.thread_id,
        in_reply_to: replyTo.message_id,
        issue_id: issueId,
        provider: 'google',
      }
    })
    setReplyBody('')
    setReplyTo(null)
    setSending(false)
    await load()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Email Thread</h4>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> Sync
        </button>
      </div>
      {loading && <p className="text-xs text-zinc-500">Loading emails...</p>}
      {emails.length === 0 && !loading && (
        <p className="text-xs text-zinc-500">No emails linked to this issue.</p>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {emails.map(email => (
          <div key={email.id}
            className={`rounded-lg border p-3 ${email.is_sent ? 'border-[#48B8FF]/30 bg-[#48B8FF]/5' : 'border-zinc-700 bg-zinc-800/40'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <p className="text-xs font-medium text-white">{email.from_name || email.from_email}</p>
                <p className="text-[10px] text-zinc-500">{email.subject}</p>
              </div>
              <p className="text-[10px] text-zinc-600 flex-shrink-0">
                {email.provider_received_at
                  ? formatDistanceToNow(new Date(email.provider_received_at), { addSuffix: true })
                  : ''}
              </p>
            </div>
            <p className="text-xs text-zinc-300 line-clamp-3">{email.snippet}</p>
            <button onClick={() => setReplyTo(email)}
              className="mt-1.5 text-[10px] text-[#48B8FF] hover:underline">Reply</button>
          </div>
        ))}
      </div>
      {replyTo && (
        <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
          <p className="text-xs text-zinc-400">Replying to {replyTo.from_email}</p>
          <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2
              text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#48B8FF] resize-none" />
          <div className="flex gap-2">
            <button onClick={sendReply} disabled={!replyBody.trim() || sending}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#48B8FF] text-[#1A1A2E]
                rounded text-xs font-semibold disabled:opacity-50">
              <Send size={11} /> {sending ? 'Sending...' : 'Send Reply'}
            </button>
            <button onClick={() => { setReplyTo(null); setReplyBody('') }}
              className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

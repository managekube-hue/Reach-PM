// hooks/useChannelManagement.ts
// Spec Part 16 — addMember, removeMember, archive, rename
import { createBrowserClient } from '@/lib/supabase'

export function useChannelManagement(channelId: string) {
  const supabase = createBrowserClient()

  async function addMember(userId: string) {
    const { data } = await supabase.from('channels')
      .select('members').eq('id', channelId).single()
    const members = [...new Set([...(data?.members ?? []), userId])]
    await supabase.from('channels').update({ members }).eq('id', channelId)
  }

  async function removeMember(userId: string) {
    const { data } = await supabase.from('channels')
      .select('members').eq('id', channelId).single()
    const members = (data?.members ?? []).filter((id: string) => id !== userId)
    await supabase.from('channels').update({ members }).eq('id', channelId)
  }

  async function archive() {
    await supabase.from('channels')
      .update({ is_archived: true }).eq('id', channelId)
  }

  async function rename(newName: string) {
    const slug = newName.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await supabase.from('channels')
      .update({ name: slug }).eq('id', channelId)
  }

  return { addMember, removeMember, archive, rename }
}

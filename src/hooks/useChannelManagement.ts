// hooks/useChannelManagement.ts
// Channel management via comm_conversations + comm_conversation_members
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function useChannelManagement(channelId: string) {
  const supabase = createBrowserClient()
  const { user, workspaceId } = useReachStore()

  async function addMember(userId: string) {
    if (!workspaceId) return
    await supabase.from('comm_conversation_members').upsert(
      { conversation_id: channelId, user_id: userId, workspace_id: workspaceId, role: 'member' },
      { onConflict: 'conversation_id,user_id' }
    )
  }

  async function removeMember(userId: string) {
    await supabase
      .from('comm_conversation_members')
      .delete()
      .eq('conversation_id', channelId)
      .eq('user_id', userId)
  }

  async function rename(newName: string) {
    const slug = newName.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await supabase
      .from('comm_conversations')
      .update({ name: newName, slug })
      .eq('id', channelId)
  }

  return { addMember, removeMember, rename }
}


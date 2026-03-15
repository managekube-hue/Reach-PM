import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage, Channel } from '../types';
// WebRTC is now handled by VideoRoom + useWebRTC (Supabase Realtime signaling).
// useCommunication retains legacy comm_conversations/comm_messages support.

export function useCommunication(workspaceId: string, userId: string, userName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [commConversations, setCommConversations] = useState<Array<{ id: string; name: string; kind: string; workspace_id: string | null }>>([]);
  const [commMembers, setCommMembers] = useState<any[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [commError, setCommError] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);

  // WebRTC streams now managed by VideoRoom component directly
  const localStream: MediaStream | null = null;
  const remoteStreams: Map<string, MediaStream> = new Map();
  const participants: any[] = [];

  const loadCommConversations = async (workspaceUuid: string) => {
    if (!supabase || !userId) return;

    const { data, error } = await supabase
      .from('comm_conversation_members')
      .select('conversation:comm_conversations(id,name,kind,workspace_id)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    const rows = (data || [])
      .map((row: any) => row.conversation)
      .filter((conversation: any) => !conversation?.workspace_id || conversation.workspace_id === workspaceUuid);

    setCommConversations(rows);
  };

  const loadCommMembers = async (workspaceUuid: string) => {
    if (!supabase) return;
    const { data: memberRows, error: memberErr } = await supabase.rpc('comm_workspace_directory', {
      p_workspace_id: workspaceUuid,
    });
    if (memberErr || !memberRows) return;
    setCommMembers((memberRows as any[]).map((row) => ({
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        user_name: row.display_name || row.user_id,
        email: row.email || null,
        role: row.role,
        home_workspace_id: row.default_workspace_id || null,
    })));
  };

  const loadCommMessages = async (conversationId: string) => {
    if (!supabase) return;
    const { data: messageRows, error: msgErr } = await supabase
      .from('comm_messages')
      .select('id,sender_user_id,body,attachments,created_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (msgErr || !messageRows) return;
    // Map to ChatMessage type (simplification, you'd pull profiles here too)
    const formatted: ChatMessage[] = messageRows.map(row => ({
      id: row.id,
      userId: row.sender_user_id,
      userName: row.sender_user_id,
      text: row.body,
      timestamp: row.created_at,
      avatar: undefined,
    }));
    setMessages(formatted);
  };

  return {
    messages,
    setMessages,
    commConversations,
    commMembers,
    currentChannel,
    setCurrentChannel,
    commError,
    setCommError,
    socket,
    localStream,
    remoteStreams,
    participants,
    isVideoActive,
    setIsVideoActive,
    loadCommConversations,
    loadCommMembers,
    loadCommMessages,
  };
}

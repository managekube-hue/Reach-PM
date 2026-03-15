export interface User {
  id: string;
  name: string;
  roomId: string;
  workspaceId: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  timestamp: number;
}

export interface Channel {
  id: string;
  workspace_id: string;
  team_id?: string | null;
  name: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  name: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  user_name: string;
  role: string;
}

export interface Workspace {
  id: string;
  name: string;
  channels: Channel[];
  teams: Team[];
  members: WorkspaceMember[];
}

export type SignalData = {
  type: "offer" | "answer" | "candidate";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};

// ── CommCollab v3 types ─────────────────────────────────────────
// Maps directly to the real Supabase tables: comm_conversations,
// comm_messages, comm_notifications, comm_presence

export type CommConversationKind = 'channel' | 'dm' | 'issue' | 'meeting';
export type CommMessageKind = 'message' | 'system' | 'command' | 'event';

export interface CommChannel {
  id: string;
  workspace_id: string;
  kind: CommConversationKind;
  name: string;
  slug?: string | null;
  topic?: string;
  is_private: boolean;
  issue_key?: string | null;
  direct_key?: string | null;
  metadata?: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CommMessage {
  id: string;
  conversation_id: string;
  workspace_id?: string | null;
  sender_user_id: string;
  sender?: { id: string; display_name: string; avatar_url?: string; color?: string } | null;
  kind: CommMessageKind;
  body: string;
  parent_message_id?: string | null;
  issue_key?: string | null;
  mentions: any[];
  attachments: Array<{ url: string; name: string; type: string; size: number; thumbnail_url?: string }>;
  command_name?: string | null;
  command_payload?: Record<string, any>;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export interface CommNotification {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: string;
  payload: Record<string, any>;
  read_at?: string | null;
  created_at: string;
}

export interface CommMeeting {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  channel_id?: string | null;
  title: string;
  description?: string | null;
  room_code: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_secs?: number | null;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  host_id?: string | null;
  recording_path?: string | null;
  recording_url?: string | null;
  external_emails: string[];
  created_at: string;
}

export interface EmailThread {
  id: string;
  workspace_id: string;
  user_id: string;
  issue_id?: string | null;
  channel_id?: string | null;
  provider: 'google' | 'microsoft';
  thread_id: string;
  message_id?: string | null;
  subject?: string | null;
  from_name?: string | null;
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  body_text?: string | null;
  body_html?: string | null;
  snippet?: string | null;
  in_reply_to?: string | null;
  labels: string[];
  is_read: boolean;
  is_sent: boolean;
  has_attachments: boolean;
  provider_received_at?: string | null;
  created_at: string;
}

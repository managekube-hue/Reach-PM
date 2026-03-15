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

// ── CommCollab v3 types ──────────────────────────────────────────

export interface CommChannel {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  name: string;
  description?: string | null;
  is_dm: boolean;
  is_private: boolean;
  is_archived: boolean;
  members: string[];
  created_by?: string | null;
  pinned_count: number;
  created_at: string;
}

export interface CommMessage {
  id: string;
  workspace_id: string;
  channel_id: string;
  author_id?: string | null;
  author?: { id: string; display_name: string; avatar_url?: string; color?: string } | null;
  body: string;
  is_system: boolean;
  issue_id?: string | null;
  issue?: any | null;
  thread_of?: string | null;
  thread_count: number;
  last_reply_at?: string | null;
  edited: boolean;
  edited_at?: string | null;
  reactions: Record<string, string[]>;
  mentions: string[];
  attachments: Array<{ url: string; name: string; type: string; size: number; thumbnail_url?: string }>;
  link_preview?: { url: string; title: string; description: string; image?: string; domain: string } | null;
  deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
}

export interface CommNotification {
  id: string;
  workspace_id?: string | null;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  issue_id?: string | null;
  message_id?: string | null;
  channel_id?: string | null;
  actor_id?: string | null;
  read: boolean;
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

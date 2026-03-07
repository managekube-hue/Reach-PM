import { supabase } from './supabase';

export type PresenceStatus = 'online' | 'available' | 'out_of_office' | 'last_seen' | 'offline';

export type CommandBindingAction =
  | 'send-message'
  | 'close-dropdown'
  | 'global-search'
  | 'link-issue'
  | 'start-huddle'
  | 'edit-last-message';

export const CHAT_KEY_BINDINGS: Record<string, CommandBindingAction> = {
  'Control+Enter': 'send-message',
  Escape: 'close-dropdown',
  'Control+k': 'global-search',
  'Control+l': 'link-issue',
  'Control+m': 'start-huddle',
  ArrowUp: 'edit-last-message',
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export async function openDirectMessage(params: {
  workspaceId: string;
  targetUserId: string;
  issueKey?: string;
  targetWorkspaceId?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-open-dm', { body: params });
  if (error) throw error;
  return data as { conversationId: string };
}

export async function sendCommunicationMessage(params: {
  conversationId: string;
  body: string;
  kind?: 'message' | 'system' | 'command' | 'meeting_event';
  parentMessageId?: string;
  commandName?: string;
  commandPayload?: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-send-message', { body: params });
  if (error) throw error;
  return data as { message: any };
}

export async function setCommunicationPresence(params: {
  workspaceId: string;
  status: PresenceStatus;
  availabilityText?: string;
  issueKey?: string;
  filePath?: string;
  lineNumber?: number;
  cursorMeta?: Record<string, unknown>;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-set-presence', { body: params });
  if (error) throw error;
  return data as { presence: any };
}

export async function heartbeatCommunicationPresence(params: {
  workspaceId: string;
  status: PresenceStatus;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-presence-heartbeat', { body: params });
  if (error) throw error;
  return data as { ok: boolean };
}

export async function getCommunicationPresenceSnapshot(params: {
  workspaceId: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-presence-snapshot', { body: params });
  if (error) throw error;
  return data as {
    workspaceId: string;
    generatedAt: string;
    members: Array<{
      userId: string;
      userName: string;
      role: string;
      status: PresenceStatus;
      online: boolean;
      lastActiveAt: string | null;
    }>;
  };
}

export async function scheduleCommunicationMeeting(params: {
  workspaceId: string;
  title: string;
  scheduledFor: string;
  durationMinutes?: number;
  participantIds?: string[];
  participantWorkspaces?: Array<{ userId: string; workspaceId: string }>;
  conversationId?: string;
  issueKey?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-schedule-meeting', { body: params });
  if (error) throw error;
  return data as { meetingId: string };
}

export async function respondToCommunicationMeeting(params: {
  meetingId: string;
  response: 'accepted' | 'declined' | 'tentative' | 'pending';
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-meeting-rsvp', { body: params });
  if (error) throw error;
  return data as { meetingId: string; response: string };
}

export async function routeCommunicationCommand(params: {
  workspaceId: string;
  conversationId: string;
  input: string;
  issueKey?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-command-router', { body: params });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function createWorkspaceUser(params: {
  workspaceId: string;
  email: string;
  displayName: string;
  password?: string;
  role?: 'owner' | 'admin' | 'employee';
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('comm-admin-create-user', { body: params });
  if (error) throw error;
  return data as {
    userId: string;
    email: string;
    displayName: string;
    workspaceId: string;
    role: 'owner' | 'admin' | 'employee';
    invited: boolean;
  };
}

export function resolveChatKeyBinding(event: KeyboardEvent): CommandBindingAction | null {
  const key = `${event.ctrlKey ? 'Control+' : ''}${event.key}`;
  return CHAT_KEY_BINDINGS[key] ?? null;
}

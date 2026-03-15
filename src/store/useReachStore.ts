import { create } from 'zustand';
import { produce } from 'immer';
import { supabase } from '../lib/supabase';
import { getTenantRuntime } from '../services/TenantRuntimeWorker';
import type { CommChannel, CommMessage, CommNotification, CommMeeting, EmailThread } from '../types';

// ==========================================
// STATE TYPES
// ==========================================
interface ReachState {
  tenantId: string | null;
  userId: string | null;
  role: 'admin' | 'member' | 'viewer';
  
  // Sync Status
  isOnline: boolean;
  syncQueueLength: number;

  // Domain Data
  issues: Record<string, any>;
  sprints: Record<string, any>;
  channels: Record<string, any>;
  members: Record<string, any>;

  // ── CommCollab v3 ───────────────────────────────────────────────
  // C-02: workspaceId (workspace_id) separate from tenantId for spec compat
  workspaceId: string | null;
  user: any | null;
  // Chat slice (v3Channels is the array form; existing channels stays as Record)
  v3Channels: CommChannel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  activeThread: string | null;
  // Notification slice
  v3Notifications: CommNotification[];
  unreadNotifCount: number;
  // Meeting slice
  activeMeeting: CommMeeting | null;
  // Email slice
  emailThreads: EmailThread[];
  // Actions
  setWorkspaceId: (id: string | null) => void;
  setUser: (user: any) => void;
  setV3Channels: (channels: CommChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setUnreadCount: (channelId: string, count: number) => void;
  incrementUnread: (channelId: string) => void;
  setActiveThread: (msgId: string | null) => void;
  addNotification: (n: CommNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotifsRead: () => void;
  setActiveMeeting: (m: CommMeeting | null) => void;
  setEmailThreads: (threads: EmailThread[]) => void;
  // ───────────────────────────────────────────────────────────────

  // Actions
  initStore: (tenantId: string, userId: string, role: string) => Promise<void>;
  addIssue: (issue: any) => Promise<void>;
  updateIssue: (id: string, updates: any) => Promise<void>;
  sendMessage: (channelId: string, body: string) => Promise<void>;
  
  // Background Sync
  processSyncQueue: () => Promise<void>;
}

// ==========================================
// ZUSTAND STORE
// ==========================================
export const useReachStore = create<ReachState>((set, get) => ({
  tenantId: null,
  userId: null,
  role: 'viewer',
  
  isOnline: navigator.onLine,
  syncQueueLength: 0,

  issues: {},
  sprints: {},
  channels: {},
  members: {},

  // ── CommCollab v3 initial state ────────────────────────────────
  workspaceId: null,
  user: null,
  v3Channels: [],
  activeChannelId: null,
  unreadCounts: {},
  activeThread: null,
  v3Notifications: [],
  unreadNotifCount: 0,
  activeMeeting: null,
  emailThreads: [],

  setWorkspaceId: (id) => set(produce((s: ReachState) => { s.workspaceId = id; })),
  setUser: (u) => set(produce((s: ReachState) => { s.user = u; })),
  setV3Channels: (chs) => set(produce((s: ReachState) => { s.v3Channels = chs; })),
  setActiveChannel: (id) => set(produce((s: ReachState) => {
    s.activeChannelId = id;
    s.activeThread = null;
  })),
  setUnreadCount: (channelId, count) => set(produce((s: ReachState) => {
    s.unreadCounts[channelId] = count;
  })),
  incrementUnread: (channelId) => set(produce((s: ReachState) => {
    s.unreadCounts[channelId] = (s.unreadCounts[channelId] || 0) + 1;
  })),
  setActiveThread: (msgId) => set(produce((s: ReachState) => {
    s.activeThread = msgId;
  })),
  addNotification: (n) => set(produce((s: ReachState) => {
    s.v3Notifications.unshift(n as any);
    if (!n.read) s.unreadNotifCount++;
  })),
  markNotificationRead: (id) => set(produce((s: ReachState) => {
    const n = s.v3Notifications.find((x: any) => x.id === id);
    if (n && !(n as any).read) { (n as any).read = true; s.unreadNotifCount--; }
  })),
  markAllNotifsRead: () => set(produce((s: ReachState) => {
    s.v3Notifications.forEach((n: any) => { n.read = true; });
    s.unreadNotifCount = 0;
  })),
  setActiveMeeting: (m) => set(produce((s: ReachState) => { s.activeMeeting = m as any; })),
  setEmailThreads: (threads) => set(produce((s: ReachState) => { s.emailThreads = threads as any; })),
  // ──────────────────────────────────────────────────────────────

  initStore: async (tenantId, userId, role) => {
    // Note: Important to set tenantId first so UI can transition away from "Loading Workspace..."
    set({ tenantId, userId, role: role as any });

    // Load current user profile and set workspaceId (C-02)
    if (userId && supabase) {
      supabase.from('profiles').select('*').eq('id', userId).single()
        .then(({ data }) => {
          if (data) {
            set(produce((s: ReachState) => {
              s.user = data;
              s.workspaceId = data.default_workspace_id ?? tenantId;
            }));
          }
        });
    }
    
    try {
      // 1. Load initial state via Supabase strictly bounded by RLS
      const [issuesRes, membersRes, channelsRes] = await Promise.all([
        supabase!.from('issues').select('*'),
        supabase!.from('profiles').select('*'),
        supabase!.from('chat_channels').select('*')
      ]);

      set(produce((state: ReachState) => {
        if (issuesRes.data) issuesRes.data.forEach(i => { state.issues[i.id] = i; });
        if (membersRes.data) membersRes.data.forEach(m => { state.members[m.id] = m; });
        if (channelsRes.data) channelsRes.data.forEach(c => { state.channels[c.id] = c; });
      }));
    } catch (e) {
      console.warn("Could not load initial database state for tenant", e);
    }

    // 2. Setup Realtime Subscriptions
    const channel = supabase.channel(`tenant:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, payload => {
        set(produce((state: ReachState) => {
          if (payload.eventType === 'DELETE') delete state.issues[(payload.old as any).id];
          else state.issues[(payload.new as any).id] = payload.new;
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        // Chat messages are handled by TenantRuntimeWorker locally for speed,
        // but we receive remote peer messages here.
        const newMsg = payload.new as any;
        getTenantRuntime(tenantId).saveMessage(
          newMsg.channel_id,
          newMsg.sender_id,
          newMsg.body,
          newMsg.id
        );
      })
      .subscribe();

    // 3. Keep online status updated
    window.addEventListener('online', () => {
      set({ isOnline: true });
      get().processSyncQueue();
    });
    window.addEventListener('offline', () => set({ isOnline: false }));

    // Init local IDB
    getTenantRuntime(tenantId);
  },

  addIssue: async (issueParams: any) => {
    const { tenantId, userId } = get();
    if (!tenantId || !userId) return;

    const newIssue = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      reporter_id: userId,
      status: 'todo',
      created_at: new Date().toISOString(),
      ...issueParams
    };

    // 1. Optimistic Update
    set(produce((state: ReachState) => {
      state.issues[newIssue.id] = newIssue;
    }));

    // 2. CRDT Queue
    if (get().isOnline) {
      const { error } = await supabase.from('issues').insert(newIssue);
      if (error) await getTenantRuntime(tenantId).queueMutation('insert_issue', newIssue);
    } else {
      await getTenantRuntime(tenantId).queueMutation('insert_issue', newIssue);
      set(produce((state: ReachState) => { state.syncQueueLength++; }));
    }
  },

  updateIssue: async (id: string, updates: any) => {
    const { tenantId } = get();
    if (!tenantId) return;

    // 1. Optimistic Update
    set(produce((state: ReachState) => {
      if (state.issues[id]) {
        Object.assign(state.issues[id], updates);
      }
    }));

    // 2. Network Update
    if (get().isOnline) {
      const { error } = await supabase.from('issues').update(updates).eq('id', id);
      if (error) await getTenantRuntime(tenantId).queueMutation('update_issue', { id, ...updates });
    } else {
      await getTenantRuntime(tenantId).queueMutation('update_issue', { id, ...updates });
      set(produce((state: ReachState) => { state.syncQueueLength++; }));
    }
  },

  sendMessage: async (channelId: string, body: string) => {
    const { tenantId, userId } = get();
    if (!tenantId || !userId) return;

    // Save to IDB instantly (event-sourced)
    const runtime = getTenantRuntime(tenantId);
    const msg = await runtime.saveMessage(channelId, userId, body);

    // Network Update
    if (get().isOnline) {
      const { error } = await supabase.from('chat_messages').insert({
        id: msg.id,
        tenant_id: tenantId,
        channel_id: channelId,
        sender_id: userId,
        body: msg.content
      });
      if (error) await runtime.queueMutation('insert_chat', msg);
    } else {
      set(produce((state: ReachState) => { state.syncQueueLength++; }));
    }
  },

  processSyncQueue: async () => {
    const { tenantId, isOnline } = get();
    if (!tenantId || !isOnline) return;

    // Basic queue flush example
    // A robust version checks sync_queue in Supabase or uses IDB `sync_queue`
    set({ syncQueueLength: 0 });
  }

}));
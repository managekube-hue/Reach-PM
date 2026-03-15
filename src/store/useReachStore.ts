import { create } from 'zustand';
import { produce } from 'immer';
import { supabase } from '../lib/supabase';
import { getTenantRuntime } from '../services/TenantRuntimeWorker';
import type { CommChannel, CommMessage, CommNotification, CommMeeting, EmailThread } from '../types';

// Spec-aligned type aliases
export type Channel = CommChannel;
export type Notification = CommNotification;
export type Meeting = CommMeeting;

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

  // ── CommCollab slices (spec-aligned) ──────────────────────────
  workspaceId: string | null;
  tenant: { id: string } | null;
  user: any | null;
  // Chat slice
  channels: CommChannel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  activeThread: string | null;
  // Notification slice
  notifications: CommNotification[];
  unreadNotifCount: number;
  // Meeting slice
  activeMeeting: CommMeeting | null;
  // Email slice
  emailThreads: EmailThread[];
  // Actions
  setWorkspaceId: (id: string | null) => void;
  setUser: (user: any) => void;
  setChannels: (channels: CommChannel[]) => void;
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

  // ── CommCollab initial state (spec-aligned) ────────────────────
  workspaceId: null,
  tenant: null,
  user: null,
  channels: [],
  activeChannelId: null,
  unreadCounts: {},
  activeThread: null,
  notifications: [],
  unreadNotifCount: 0,
  activeMeeting: null,
  emailThreads: [],

  setWorkspaceId: (id) => set(produce((s: ReachState) => { s.workspaceId = id; })),
  setUser: (u) => set(produce((s: ReachState) => { s.user = u; })),
  setChannels: (chs) => set(produce((s: ReachState) => { s.channels = chs; })),
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
    const notif = { ...n, read: !!(n as any).read || !!(n as any).read_at } as any;
    s.notifications.unshift(notif);
    if (!notif.read) s.unreadNotifCount++;
  })),
  markNotificationRead: (id) => set(produce((s: ReachState) => {
    const n = s.notifications.find((x: any) => x.id === id);
    if (n && !(n as any).read) { (n as any).read = true; s.unreadNotifCount--; }
  })),
  markAllNotifsRead: () => set(produce((s: ReachState) => {
    s.notifications.forEach((n: any) => { n.read = true; });
    s.unreadNotifCount = 0;
  })),
  setActiveMeeting: (m) => set(produce((s: ReachState) => { s.activeMeeting = m as any; })),
  setEmailThreads: (threads) => set(produce((s: ReachState) => { s.emailThreads = threads as any; })),
  // ──────────────────────────────────────────────────────────────

  initStore: async (tenantId, userId, role) => {
    // Note: Important to set tenantId first so UI can transition away from "Loading Workspace..."
    set({ tenantId, userId, role: role as any });

    // Load current user profile; set tenant + workspaceId
    if (userId && supabase) {
      supabase.from('profiles').select('*').eq('id', userId).single()
        .then(({ data }) => {
          if (data) {
            set(produce((s: ReachState) => {
              s.user = data;
              s.tenant = { id: tenantId };
              s.workspaceId = data.default_workspace_id ?? tenantId;
            }));
          }
        });
    }
    
    try {
      // 1. Load initial state via Supabase strictly bounded by RLS
      const [issuesRes, membersRes] = await Promise.all([
        supabase!.from('issues').select('*'),
        supabase!.from('profiles').select('*'),
      ]);

      set(produce((state: ReachState) => {
        if (issuesRes.data) issuesRes.data.forEach(i => { state.issues[i.id] = i; });
        if (membersRes.data) membersRes.data.forEach(m => { state.members[m.id] = m; });
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
      .subscribe();

    // 3. Keep online status updated
    window.addEventListener('online', () => {
      set({ isOnline: true });
      get().processSyncQueue();
    });
    window.addEventListener('offline', () => set({ isOnline: false }));
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
    const { user } = get();
    if (!channelId || !user?.id || !body.trim()) return;

    if (get().isOnline) {
      await supabase.from('messages').insert({
        channel_id: channelId,
        body: body.trim(),
        is_system: false,
      });
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
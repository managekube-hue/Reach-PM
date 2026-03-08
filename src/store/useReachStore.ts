import { create } from 'zustand';
import { produce } from 'immer';
import { supabase } from '../lib/supabase';
import { getTenantRuntime } from '../services/TenantRuntimeWorker';

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

  initStore: async (tenantId, userId, role) => {
    set({ tenantId, userId, role: role as any });
    
    // 1. Load initial state via Supabase strictly bounded by RLS
    const [issuesRes, membersRes, channelsRes] = await Promise.all([
      supabase.from('issues').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('chat_channels').select('*')
    ]);

    set(produce((state: ReachState) => {
      if (issuesRes.data) issuesRes.data.forEach(i => { state.issues[i.id] = i; });
      if (membersRes.data) membersRes.data.forEach(m => { state.members[m.id] = m; });
      if (channelsRes.data) channelsRes.data.forEach(c => { state.channels[c.id] = c; });
    }));

    // 2. Setup Realtime Subscriptions
    const channel = supabase.channel(`tenant:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, payload => {
        set(produce((state: ReachState) => {
          if (payload.eventType === 'DELETE') delete state.issues[payload.old.id];
          else state.issues[payload.new.id] = payload.new;
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        // Chat messages are handled by TenantRuntimeWorker locally for speed,
        // but we receive remote peer messages here.
        getTenantRuntime(tenantId).saveMessage(
          payload.new.channel_id,
          payload.new.sender_id,
          payload.new.body,
          payload.new.id
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
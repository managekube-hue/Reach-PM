import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ReachDBSchema extends DBSchema {
  sync_queue: {
    key: string;
    value: { id: string; action: string; payload: any; status: 'pending' | 'syncing'; timestamp: number };
  };
  tenant_state: {
    key: string;
    value: any;
  };
  ide_files: {
    key: string;
    value: { path: string; content: string; updated_at: number };
  };
  chat_messages: {
    key: string;
    value: { id: string; channel_id: string; user_id: string; content: string; created_at: number };
    indexes: { 'by-channel': string };
  };
}

export class TenantRuntime {
  private dbPromise: Promise<IDBPDatabase<ReachDBSchema>>;
  public tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    // Each tenant gets their own isolated IndexedDB wrapper
    this.dbPromise = openDB<ReachDBSchema>(`reach-tenant-${tenantId}`, 1, {
      upgrade(db) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
        db.createObjectStore('tenant_state');
        db.createObjectStore('ide_files', { keyPath: 'path' });
        
        const chatStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
        chatStore.createIndex('by-channel', 'channel_id');
      },
    });
  }

  // ==========================================
  // IDE FILE SYSTEM (Local-First Access)
  // ==========================================
  async saveFile(path: string, content: string) {
    const db = await this.dbPromise;
    const now = Date.now();
    await db.put('ide_files', { path, content, updated_at: now });
    
    // Broadcast instantly to UI and WebRTC mesh
    this.emitMutation('file_save', { path, content, timestamp: now });
  }

  async getFile(path: string) {
    const db = await this.dbPromise;
    return db.get('ide_files', path);
  }

  // ==========================================
  // CHAT SYSTEM (Event Sourced)
  // ==========================================
  async saveMessage(channelId: string, userId: string, content: string, msgId?: string) {
    const db = await this.dbPromise;
    const id = msgId || crypto.randomUUID();
    const created_at = Date.now();
    
    const msg = { id, channel_id: channelId, user_id: userId, content, created_at };
    await db.put('chat_messages', msg);
    
    // Queue for background server sync
    await this.queueMutation('chat_insert', msg);
    
    // Broadcast across Mesh network
    this.emitMutation('chat_insert', msg);
    return msg;
  }

  async getMessages(channelId: string) {
    const db = await this.dbPromise;
    return db.getAllFromIndex('chat_messages', 'by-channel', channelId);
  }

  // ==========================================
  // SYNC QUEUE & MESH BROADCAST
  // ==========================================
  async queueMutation(action: string, payload: any) {
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    await db.put('sync_queue', { id, action, payload, status: 'pending', timestamp: Date.now() });
  }

  private emitMutation(action: string, payload: any) {
    // This allows UI and the WebRTC data channel to instantly pick up local changes
    window.dispatchEvent(new CustomEvent('reach-local-mutation', { 
      detail: { tenantId: this.tenantId, action, payload }
    }));
  }
}

// Singleton manager to rapidly switch contexts in browser without reload
let activeRuntime: TenantRuntime | null = null;

export const getTenantRuntime = (workspaceId: string): TenantRuntime => {
  if (!activeRuntime || activeRuntime.tenantId !== workspaceId) {
    activeRuntime = new TenantRuntime(workspaceId);
  }
  return activeRuntime;
};
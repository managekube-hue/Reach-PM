import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  MessageSquare, 
  Users, 
  Hash, 
  Send, 
  LogOut,
  Monitor,
  Settings,
  Plus,
  ChevronRight,
  Menu,
  X,
  Building2,
  Info,
  AlertCircle,
  Smile,
  Paperclip,
  FileText,
  Image as ImageIcon,
  UserPlus,
  Home,
  CheckSquare,
  Clock,
  Code2,
  BarChart3,
  Layers,
  FileDown,
  Trash2,
  Star,
  Search,
  Layout,
  Bell,
  HelpCircle,
  Maximize2,
  AtSign,
  Bookmark,
  Zap,
  MoreHorizontal,
  ShieldCheck,
  Headphones,
  Pin,
  FileCode,
  ExternalLink,
  Circle,
  ChevronDown,
  CalendarDays,
  ListTodo,
  UserCheck
} from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useWebRTC } from './hooks/useWebRTC';
import { ChatMessage, User, Workspace, Channel, Team } from './types';
import { NEW_GLOBAL_NAV, NAVIGATION_TREE } from './constants';
import { supabase } from './lib/supabase';
import {
  createWorkspaceUser,
  getCommunicationPresenceSnapshot,
  heartbeatCommunicationPresence,
  openDirectMessage,
  respondToCommunicationMeeting,
  routeCommunicationCommand,
  scheduleCommunicationMeeting,
  sendCommunicationMessage,
  setCommunicationPresence,
} from './lib/reachCommunication';
import { SprintTable } from './components/views/SprintTable';
import { BacklogPlanning } from './components/views/BacklogPlanning';
import { SprintBoard } from './components/views/SprintBoard';
import { IDEView } from './components/views/IDEView';
import { DocsView } from './components/views/DocsView';
import { DashboardView } from './components/views/DashboardView';

const OLD_GLOBAL_NAV = [
  { icon: Home, label: 'Home', id: 'home' },
  { icon: MessageSquare, label: 'DMs', id: 'dms' },
  { icon: Bell, label: 'Activity', id: 'activity', badge: 2 },
  { icon: Bookmark, label: 'Later', id: 'later' },
  { icon: Zap, label: 'Tools', id: 'tools' },
  { icon: MoreHorizontal, label: 'More', id: 'more' },
  { icon: ShieldCheck, label: 'Admin', id: 'admin' },
];

const SIDEBAR_SECTIONS = [
  { icon: MessageSquare, label: 'Unreads', id: 'unreads' },
  { icon: AtSign, label: 'Threads', id: 'threads' },
  { icon: Headphones, label: 'UPS', id: 'huddles' },
  { icon: Send, label: 'Drafts & sent', id: 'drafts' },
  { icon: Users, label: 'Directories', id: 'directories' },
];

const FAVORITES = [
  { id: '1', name: 'Board 4' },
  { id: '2', name: 'Board 3' },
  { id: '3', name: 'Scrum board' },
  { id: '4', name: 'Board 6' },
  { id: '5', name: 'Kanban Board 3' },
];

const WORKSPACE_STORAGE_KEY = 'reach:workspace-id';

function getInitialWorkspaceId() {
  const fromStorage = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  return 'default-workspace';
}

type PresenceOptionValue = 'online' | 'available' | 'out_of_office' | 'last_seen';

const PRESENCE_OPTIONS: Array<{ value: PresenceOptionValue; label: string; hint: string }> = [
  { value: 'online', label: 'Online', hint: 'Active in workspace' },
  { value: 'available', label: 'Available', hint: 'Ready for meetings' },
  { value: 'out_of_office', label: 'Out of office', hint: 'Do not disturb' },
  { value: 'last_seen', label: 'Last seen', hint: 'Shown as unavailable' },
];

function getStatusLabel(status: string) {
  if (status === 'out_of_office') return 'Out of office';
  if (status === 'last_seen') return 'Last seen';
  if (status === 'available') return 'Available';
  if (status === 'online') return 'Online';
  return 'Offline';
}

function getStatusDotClass(status: string) {
  if (status === 'available') return 'bg-emerald-400';
  if (status === 'online') return 'bg-sky-400';
  if (status === 'out_of_office') return 'bg-orange-400';
  return 'bg-[#64748b]';
}

function formatLastSeen(lastActiveAt: number | null) {
  if (!lastActiveAt) return 'No activity yet';
  return new Date(lastActiveAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(value: string) {
  const clean = (value || '').trim();
  if (!clean) return '?';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

export default function App() {
  type CommMember = {
    workspace_id: string;
    user_id: string;
    user_name: string;
    email?: string | null;
    role: string;
    home_workspace_id?: string | null;
  };

  type WorkspacePresence = {
    userId: string;
    userName: string;
    role: string;
    online: boolean;
    status: PresenceOptionValue | 'offline';
    lastActiveAt: number | null;
  };

  type ReachNotification = {
    id: string;
    user_id: string;
    workspace_id: string;
    kind: string;
    payload: Record<string, any>;
    read_at: string | null;
    created_at: string;
  };

  type IssueActivityItem = {
    id: string;
    issue_key: string;
    action: string;
    summary: string;
    actor_user_id: string | null;
    created_at: string;
  };

  const [userName, setUserName] = useState('');
  const [workspaceId, setWorkspaceId] = useState(getInitialWorkspaceId);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'private'>('public');
  const [createChannelStep, setCreateChannelStep] = useState<1 | 2 | 3>(1);
  const [newChannelMemberIds, setNewChannelMemberIds] = useState<string[]>([]);
  const [newChannelMemberSearch, setNewChannelMemberSearch] = useState('');
  const [workspacePresence, setWorkspacePresence] = useState<WorkspacePresence[]>([]);
  const [supabaseWorkspaceId, setSupabaseWorkspaceId] = useState<string | null>(null);
  const [workspaceChoices, setWorkspaceChoices] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [commConversationId, setCommConversationId] = useState<string | null>(null);
  const [commConversations, setCommConversations] = useState<Array<{ id: string; name: string; kind: string; workspace_id: string | null }>>([]);
  const [commMembers, setCommMembers] = useState<CommMember[]>([]);
  const [selectedDmUserId, setSelectedDmUserId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{ user_id: string; display_name: string; email: string | null; default_workspace_id: string | null }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [newCommChannelName, setNewCommChannelName] = useState('');
  const [isCreatingCommChannel, setIsCreatingCommChannel] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'owner' | 'admin' | 'employee'>('employee');
  const [isCreatingWorkspaceUser, setIsCreatingWorkspaceUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);
  const [commError, setCommError] = useState<string | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [myStatus, setMyStatus] = useState<PresenceOptionValue>('available');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [isWorkspaceSidebarCollapsed, setIsWorkspaceSidebarCollapsed] = useState(false);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<ReachNotification[]>([]);
  const [activityItems, setActivityItems] = useState<IssueActivityItem[]>([]);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingWhen, setMeetingWhen] = useState('');
  const [meetingParticipantIds, setMeetingParticipantIds] = useState<string[]>([]);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>('messages');
  const [activeGlobalNav, setActiveGlobalNav] = useState('issues');
  const [activeSidebarItem, setActiveSidebarItem] = useState('assigned-to-me');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['issues']));

  const [showCallLauncher, setShowCallLauncher] = useState(false);
  const [callMode, setCallMode] = useState<'member' | 'channel' | 'group' | 'team'>('member');
  const [selectedCallMemberIds, setSelectedCallMemberIds] = useState<string[]>([]);
  const [selectedTeamCallId, setSelectedTeamCallId] = useState<string>('');
  const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
  const [isBackgroundBlurEnabled, setIsBackgroundBlurEnabled] = useState(false);
  const [customVideoBackgroundUrl, setCustomVideoBackgroundUrl] = useState<string | null>(null);
  const [isHuddleDragging, setIsHuddleDragging] = useState(false);
  const [isHuddleUploading, setIsHuddleUploading] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  interface TreeItemProps {
    item: any;
    level?: number;
    key?: any;
  }

  const findNode = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeNode = (NAVIGATION_TREE as any)[activeGlobalNav] || [];
  const topBarTabs = activeNode;

  const renderContent = () => {
    // Determine which view to show based on activeSidebarItem
    const currentViewId = activeSidebarItem;

    // Chat / Communication Views
    if (activeGlobalNav === 'chat') {
      return (
        <div className="flex-1 flex overflow-hidden">
          <aside className={`${isWorkspaceSidebarCollapsed ? 'w-14' : 'w-[280px]'} border-r border-[#26272e] bg-[#111217] transition-all duration-200 flex-shrink-0`}>
            <div className="h-11 px-3 border-b border-[#26272e] flex items-center justify-between">
              {!isWorkspaceSidebarCollapsed && <p className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">Workspace</p>}
              <button
                onClick={() => setIsWorkspaceSidebarCollapsed((prev) => !prev)}
                className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg"
                title={isWorkspaceSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu size={16} />
              </button>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-44px)] custom-scrollbar">
              <button
                onClick={() => setActiveSidebarItem('activity')}
                className={`w-full flex items-center ${isWorkspaceSidebarCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeSidebarItem === 'activity' ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-[#94a3b8] hover:text-white hover:bg-[#1c1d24] border border-transparent'
                }`}
                title="Issue activity"
              >
                <span className="flex items-center gap-2">
                  <Bell size={14} />
                  {!isWorkspaceSidebarCollapsed && 'Activity'}
                </span>
                {!isWorkspaceSidebarCollapsed && unreadNotifications.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">{unreadNotifications.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveSidebarItem('directory')}
                className={`w-full flex items-center ${isWorkspaceSidebarCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeSidebarItem === 'directory' ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-[#94a3b8] hover:text-white hover:bg-[#1c1d24] border border-transparent'
                }`}
                title="Directory"
              >
                <span className="flex items-center gap-2">
                  <Users size={14} />
                  {!isWorkspaceSidebarCollapsed && 'Directory'}
                </span>
              </button>

              {!isWorkspaceSidebarCollapsed && (
                <>
                  <div className="pt-2">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Channels</p>
                      <button
                        onClick={openCreateChannelWizard}
                        className="inline-flex items-center gap-1 rounded-md border border-[#303236] bg-[#16171d] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#cbd5e1] hover:bg-[#26272e]"
                        title="Create channel"
                      >
                        <Plus size={11} />
                        New
                      </button>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {channelConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => {
                            setActiveSidebarItem('messages');
                            setCommConversationId(conversation.id);
                            setCurrentChannel({
                              id: conversation.id,
                              workspace_id: conversation.workspace_id || supabaseWorkspaceId || workspaceId,
                              name: conversation.name,
                            });
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all ${
                            commConversationId === conversation.id ? 'bg-[#26272e] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#1c1d24]'
                          }`}
                        >
                          <span className="truncate"># {conversation.name}</span>
                          {(unreadCountByConversation[conversation.id] || 0) > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">{unreadCountByConversation[conversation.id]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] px-2">Direct Messages</p>
                    <div className="mt-1 space-y-0.5">
                      {directConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => {
                            setActiveSidebarItem('messages');
                            setCommConversationId(conversation.id);
                            setCurrentChannel({
                              id: conversation.id,
                              workspace_id: conversation.workspace_id || supabaseWorkspaceId || workspaceId,
                              name: conversation.name,
                            });
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all ${
                            commConversationId === conversation.id ? 'bg-[#26272e] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#1c1d24]'
                          }`}
                        >
                          <span className="truncate">@ {conversation.name}</span>
                          {(unreadCountByConversation[conversation.id] || 0) > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">{unreadCountByConversation[conversation.id]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {activeSidebarItem === 'messages' && (
                <div className="space-y-8 max-w-5xl mx-auto">
                {commError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
                    {commError}
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-40">
                    <div className="w-24 h-24 bg-[#26272e] rounded-[2rem] flex items-center justify-center mb-8">
                      <MessageSquare size={40} className="text-[#94a3b8]" />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Welcome to #{currentChannel?.name}</h4>
                    <p className="text-[#94a3b8] font-medium">This is the start of the conversation. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const isSameUser = prevMsg && prevMsg.userId === msg.userId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 300000);

                    return (
                      <div key={msg.id} className={`group flex gap-4 ${isSameUser ? '-mt-6' : ''}`}>
                        {!isSameUser ? (
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/10">
                            {msg.userName[0]?.toUpperCase() || '?'}
                          </div>
                        ) : (
                          <div className="w-10 flex-shrink-0 flex justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-[#475569] font-bold mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {!isSameUser && (
                            <div className="flex items-baseline gap-3 mb-1">
                              <span className="font-bold text-white text-[15px] hover:underline cursor-pointer">{msg.userName}</span>
                              <span className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-widest">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                onClick={() => togglePinMessage(msg.id)}
                                className={`p-1 rounded transition-all ${
                                  pinnedMessageIds.includes(msg.id)
                                    ? 'text-indigo-400 bg-indigo-500/10'
                                    : 'text-[#475569] hover:text-white hover:bg-[#26272e]'
                                }`}
                                title={pinnedMessageIds.includes(msg.id) ? 'Unpin message' : 'Pin message'}
                              >
                                <Pin size={12} />
                              </button>
                            </div>
                          )}
                          <p className="text-[15px] text-[#cbd5e1] leading-relaxed break-words">{msg.text}</p>

                          {msg.file_url && (
                            <div className="mt-3 p-4 bg-[#1e1f26] border border-[#26272e] rounded-2xl flex items-center gap-4 max-w-md group/file hover:border-indigo-500/50 transition-all cursor-pointer shadow-lg">
                              <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
                                {msg.file_type?.startsWith('image/') ? <ImageIcon size={24} /> : <FileText size={24} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{msg.file_name}</p>
                                <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest">{msg.file_type?.split('/')[1] || 'FILE'}</p>
                              </div>
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-[#94a3b8] hover:text-white transition-colors">
                                <ExternalLink size={18} />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              )}

              {activeSidebarItem === 'activity' && (
                <div className="max-w-5xl mx-auto py-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-bold text-white">Issue Activity Feed</h4>
                    <span className="text-xs text-[#94a3b8]">Work-first activity stream</span>
                  </div>
                  {activityItems.length === 0 ? (
                    <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 text-sm text-[#94a3b8]">
                      No issue activity yet in this workspace.
                    </div>
                  ) : (
                    activityItems.map((item) => (
                      <div key={item.id} className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">@issue {item.issue_key}</p>
                          <span className="text-[10px] uppercase tracking-wide text-[#64748b]">{item.action}</span>
                        </div>
                        <p className="text-sm text-[#cbd5e1] mt-1">{item.summary}</p>
                        <p className="text-[11px] text-[#64748b] mt-2">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSidebarItem === 'directory' && (
                <div className="max-w-5xl mx-auto py-8 space-y-4">
                  <h4 className="text-2xl font-bold text-white">Directory</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wide text-[#64748b] mb-3">People</p>
                      <div className="space-y-2">
                        {panelMembers.map((member) => (
                          <div key={member.user_id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full bg-[#26272e] border border-[#303236] text-white font-bold text-[10px] flex items-center justify-center"
                                title={`${member.user_name || member.user_id} (${member.user_id})`}
                              >
                                {getInitials(member.user_name || member.user_id)}
                              </div>
                              <span className="text-white truncate">{member.user_name}</span>
                            </div>
                            <span className="text-[#94a3b8] uppercase">{member.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wide text-[#64748b] mb-3">Channels</p>
                      <div className="space-y-2">
                        {channelConversations.map((conversation) => (
                          <div key={conversation.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-white truncate"># {conversation.name}</span>
                            <span className="text-[#94a3b8]">members visible in workspace</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSidebarItem === 'files' && (
                <div className="max-w-5xl mx-auto py-10">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-2xl font-bold text-white">Channel Files</h4>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                    <Plus size={18} />
                    Upload File
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {messages.filter(m => m.file_url).map(msg => (
                    <div key={msg.id} className="bg-[#16171d] border border-[#26272e] p-5 rounded-2xl hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl">
                      <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        {msg.file_type?.startsWith('image/') ? <ImageIcon size={24} /> : <FileText size={24} />}
                      </div>
                      <h5 className="font-bold text-white mb-1 truncate">{msg.file_name}</h5>
                      <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-4">{msg.file_type?.split('/')[1] || 'FILE'}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-[#26272e]">
                        <span className="text-[10px] text-[#475569] font-bold uppercase">{new Date(msg.timestamp).toLocaleDateString()}</span>
                        <ExternalLink size={14} className="text-[#94a3b8] group-hover:text-white" />
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}

              {activeSidebarItem === 'pins' && (
                <div className="max-w-5xl mx-auto py-10">
                {messages.filter((message) => pinnedMessageIds.includes(message.id)).length === 0 ? (
                  <div className="opacity-40 text-center">
                    <Pin size={48} className="mx-auto mb-4 text-[#94a3b8]" />
                    <h4 className="text-xl font-bold text-white">No Pinned Messages</h4>
                    <p className="text-[#94a3b8] mt-2">Pin a message in the channel and it appears here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.filter((message) => pinnedMessageIds.includes(message.id)).map((msg) => (
                      <div key={msg.id} className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">{msg.userName}</span>
                          <button
                            onClick={() => togglePinMessage(msg.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            Unpin
                          </button>
                        </div>
                        <p className="text-sm text-[#cbd5e1]">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              )}

              {activeSidebarItem === 'huddle' && (
                <div className="max-w-5xl mx-auto py-10 text-center">
                <div className="w-24 h-24 bg-[#26272e] rounded-[2rem] flex items-center justify-center mb-6 mx-auto">
                  <Headphones size={40} className="text-[#94a3b8]" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Standup UPS</h4>
                <p className="text-[#94a3b8] font-medium mb-6">
                  Real-time video uses WebRTC with STUN servers and can be launched from the top bar or chat composer video icon.
                </p>
                <button
                  onClick={() => setIsVideoActive(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  Start UPS
                </button>
                <button
                  onClick={() => setIsMeetingModalOpen(true)}
                  className="ml-3 bg-[#26272e] hover:bg-[#303236] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  Schedule Video Meeting
                </button>
                {notifications.filter((item) => item.kind === 'meeting_invite').length > 0 && (
                  <div className="mt-6 space-y-2 text-left max-w-3xl mx-auto">
                    {notifications
                      .filter((item) => item.kind === 'meeting_invite')
                      .map((item) => (
                        <div key={item.id} className="bg-[#16171d] border border-[#26272e] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.payload?.title || 'Meeting invite'}</p>
                            <p className="text-xs text-[#94a3b8]">{item.payload?.scheduled_for ? new Date(item.payload.scheduled_for).toLocaleString() : 'Schedule pending'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => item.payload?.meeting_id && respondMeeting(item.payload.meeting_id, 'accepted')}
                              className="px-2.5 py-1 text-[11px] rounded bg-emerald-600/30 text-emerald-200"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => item.payload?.meeting_id && respondMeeting(item.payload.meeting_id, 'declined')}
                              className="px-2.5 py-1 text-[11px] rounded bg-red-600/20 text-red-200"
                            >
                              No
                            </button>
                            <button
                              onClick={() => item.payload?.meeting_id && respondMeeting(item.payload.meeting_id, 'tentative')}
                              className="px-2.5 py-1 text-[11px] rounded bg-amber-600/20 text-amber-200"
                            >
                              Maybe
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Input Area */}
            {activeSidebarItem === 'messages' && (
              <div className="p-6 bg-[#0d0e12] border-t border-[#26272e]">
                <div className="max-w-5xl mx-auto">
                  <ChatInput
                    onSend={handleSendMessage}
                    onUploadFile={uploadCommunicationAsset}
                    onVideoClick={handleComposerVideoClick}
                    onTerminateVideo={terminateHuddle}
                    isVideoActive={isVideoActive}
                    onScheduleMeeting={() => setIsMeetingModalOpen(true)}
                    onOpenIssue={() => goToCoreView('issues', 'assigned-to-me')}
                    onOpenDocs={() => goToCoreView('chat', 'files')}
                    onOpenIDE={() => goToCoreView('code-prs', 'pull-requests')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Mapping specific IDs to Views
    switch (currentViewId) {
      case 'sprint-board':
      case 'kanban-board':
        return <SprintBoard />;
      case 'product-backlog':
      case 'sprint-planning':
        return <BacklogPlanning />;
      case 'defect-board':
      case 'issue-board':
      case 'assigned-to-me':
      case 'reported-by-me':
        return <SprintTable />;
      case 'code-prs':
      case 'my-prs':
      case 'pull-requests':
        return <IDEView />;
      case 'dashboard':
      case 'velocity-analytics':
      case 'portfolio-board':
        return <DashboardView />;
      case 'files':
      case 'screenshots':
      case 'design-files':
        return <DocsView />;
      case 'teams':
        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0d0e12]">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Team Availability</h2>
                  <p className="text-[#94a3b8] text-sm mt-1">Modern workspace presence: online, available, out of office, and last seen.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotClass(myStatus)}`} />
                  <select
                    value={myStatus}
                    onChange={(e) => handleSetStatus(e.target.value as PresenceOptionValue)}
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PRESENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#26272e] text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                  <span className="col-span-4">Member</span>
                  <span className="col-span-3">Role</span>
                  <span className="col-span-3">Status</span>
                  <span className="col-span-2">Last Activity</span>
                </div>
                <div className="divide-y divide-[#26272e]">
                  {panelMembers.map((member) => {
                    const presence = presenceByUserId.get(member.user_id);
                    const status = presence?.status || 'offline';
                    return (
                      <div key={member.user_id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 bg-[#26272e] rounded-full flex items-center justify-center text-white font-bold text-xs"
                            title={`${member.user_name || member.user_id} (${member.user_id})`}
                          >
                            {getInitials(member.user_name || member.user_id)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-semibold truncate">
                              {member.user_name}{member.user_id === userId ? ' (You)' : ''}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[#64748b]">{member.user_id}</p>
                          </div>
                        </div>
                        <p className="col-span-3 text-xs uppercase tracking-wide text-[#94a3b8]">{member.role}</p>
                        <div className="col-span-3 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusDotClass(status)}`} />
                          <span className="text-xs text-[#cbd5e1]">{getStatusLabel(status)}</span>
                        </div>
                        <p className="col-span-2 text-xs text-[#94a3b8]">
                          {status === 'last_seen' || status === 'offline'
                            ? formatLastSeen(presence?.lastActiveAt ?? null)
                            : 'Active now'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      case 'all-members': {
        const currentRole = currentMemberRole;
        const isAdminPortal = isAdminUser;

        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0d0e12]">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h2>
                  <p className="text-[#94a3b8] text-sm mt-1">Manage profiles, workspace roles, and access views by username.</p>
                </div>
                <div className="px-3 py-1.5 bg-[#0d0e12] border border-[#303236] rounded-lg text-xs font-semibold text-[#cbd5e1] uppercase tracking-wide">
                  Role: {currentRole}
                </div>
              </div>

              {roleUpdateError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
                  {roleUpdateError}
                </div>
              )}

              {memberActionError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
                  {memberActionError}
                </div>
              )}

              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Create User</h3>
                  <span className="text-[10px] uppercase tracking-wide text-[#64748b]">Admin Action</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={newUserDisplayName}
                    onChange={(e) => setNewUserDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-xs"
                  />
                  <input
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-xs"
                  />
                  <input
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Temporary password (optional)"
                    type="password"
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-xs"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'owner' | 'admin' | 'employee')}
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#94a3b8]">Creates an auth user in Supabase and adds them to this workspace.</p>
                  <button
                    onClick={createUserFromAdminPortal}
                    disabled={isCreatingWorkspaceUser || !newUserEmail.trim() || !newUserDisplayName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    {isCreatingWorkspaceUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>
                {createUserError && <p className="text-xs text-red-300">{createUserError}</p>}
                {createUserSuccess && <p className="text-xs text-emerald-300">{createUserSuccess}</p>}
              </div>

              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={userSearchTerm}
                    onChange={(e) => searchUsersByName(e.target.value)}
                    placeholder="Find user by name or email"
                    className="bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-xs w-full max-w-sm"
                  />
                  <span className="text-[11px] text-[#94a3b8]">
                    Add teammates to this workspace so they appear in this admin panel.
                  </span>
                </div>

                {userSearchTerm.trim() && (
                  <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {isSearchingUsers && <p className="text-[10px] text-[#64748b]">Searching users...</p>}
                    {!isSearchingUsers && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                        {userSearchResults.map((result) => {
                          const inWorkspace = panelMembers.some((member) => member.user_id === result.user_id);
                          const isWorking = memberActionUserId === result.user_id;
                          const displayName = result.display_name || result.email || result.user_id;

                          return (
                            <div key={result.user_id} className="bg-[#0d0e12] border border-[#303236] rounded-xl p-3 flex flex-col items-center text-center gap-2">
                              <div className="relative group">
                                <div
                                  className="w-12 h-12 rounded-full bg-indigo-600/25 border border-indigo-500/40 text-white text-xs font-bold flex items-center justify-center"
                                  title={`${displayName} (${result.user_id})`}
                                >
                                  {getInitials(displayName)}
                                </div>
                                <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 w-48 bg-[#0a0b0f] border border-[#303236] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                  <p className="text-[11px] text-white truncate">{displayName}</p>
                                  <p className="text-[10px] text-[#94a3b8] truncate">{result.user_id}</p>
                                </div>
                              </div>
                              <p className="text-[11px] text-[#cbd5e1] truncate w-full">{displayName}</p>
                              <div className="flex flex-col gap-1 w-full">
                                <button
                                  onClick={() => startPrivateCall({
                                    id: result.user_id,
                                    name: displayName,
                                    roomId: currentChannel?.id || 'general',
                                    workspaceId: result.default_workspace_id || workspaceId,
                                  })}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1 text-[10px] font-semibold"
                                >
                                  Open DM
                                </button>
                                {isAdminPortal && (
                                  <button
                                    onClick={() => addUserToWorkspace(result.user_id)}
                                    disabled={inWorkspace || isWorking}
                                    className="bg-[#26272e] hover:bg-[#303236] disabled:opacity-50 text-white rounded px-2 py-1 text-[10px] font-semibold"
                                  >
                                    {inWorkspace ? 'In Workspace' : isWorking ? 'Adding...' : 'Add Member'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[#16171d] border border-[#26272e] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#26272e] text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                  <span className="col-span-4">User</span>
                  <span className="col-span-3">Workspace</span>
                  <span className="col-span-2">Status</span>
                  <span className="col-span-3">Role / Access</span>
                </div>
                <div className="divide-y divide-[#26272e]">
                  {panelMembers.map((member) => {
                    const presence = presenceByUserId.get(member.user_id);
                    const status = presence?.status || 'offline';
                    const canEditRole = isAdminPortal && member.user_id !== userId;
                    const canRemoveMember = isAdminPortal && member.user_id !== userId && (currentRole === 'owner' || member.role !== 'owner');
                    const isWorking = memberActionUserId === member.user_id;

                    return (
                      <div key={member.user_id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 bg-[#26272e] rounded-full flex items-center justify-center text-white font-bold text-xs"
                            title={`${member.user_name || member.user_id} (${member.user_id})`}
                          >
                            {getInitials(member.user_name || member.user_id)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-semibold truncate">
                              {member.user_name}{member.user_id === userId ? ' (You)' : ''}
                            </p>
                            <p className="text-[10px] text-[#64748b] truncate">{(member as any).email || 'email hidden'}</p>
                          </div>
                        </div>
                        <p className="col-span-3 text-xs text-[#94a3b8] truncate">
                          {(workspaceChoices.find((w) => w.id === (member as any).home_workspace_id)?.name) || 'Current workspace'}
                        </p>
                        <div className="col-span-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusDotClass(status)}`} />
                          <span className="text-xs text-[#cbd5e1]">{getStatusLabel(status)}</span>
                        </div>
                        <div className="col-span-3">
                          {canEditRole ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={member.role}
                                onChange={(e) => updateMemberRole(member.user_id, e.target.value as 'owner' | 'admin' | 'employee')}
                                className="flex-1 bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-2 py-1.5 text-xs"
                              >
                                <option value="employee">Employee</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </select>
                              {canRemoveMember && (
                                <button
                                  onClick={() => removeWorkspaceMember(member.user_id)}
                                  disabled={isWorking}
                                  className="bg-red-600/20 border border-red-500/40 text-red-200 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
                                >
                                  {isWorking ? 'Removing...' : 'Remove'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs uppercase tracking-wide text-[#94a3b8]">{member.role}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isAdminPortal && (
                <div className="text-xs text-[#94a3b8]">Only admins and owners can change roles. Ask your workspace admin to grant access.</div>
              )}
            </div>
          </div>
        );
      }
      default:
        // Fallback Professional View
        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0d0e12]">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 tracking-tight uppercase">
                    {currentViewId.replace(/-/g, ' ')}
                  </h2>
                  <p className="text-[#94a3b8] text-sm font-medium">
                    Manage and track your {currentViewId.replace(/-/g, ' ')} in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-[#16171d] border border-[#26272e] rounded-xl text-sm font-bold text-[#94a3b8] hover:text-white transition-all">
                    Export
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Plus size={18} />
                    New Item
                  </button>
                </div>
              </div>

              {/* Professional Dashboard / List View */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-[#16171d] border border-[#26272e] rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-[#26272e] flex items-center justify-between bg-[#1a1d21]/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Items</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Live Updates</span>
                    </div>
                  </div>
                  <div className="divide-y divide-[#26272e]">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-4 hover:bg-[#26272e]/30 transition-all cursor-pointer group flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#0d0e12] rounded-xl flex items-center justify-center text-indigo-400 font-bold border border-[#26272e]">
                            #{100 + i}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Refactor {currentViewId} architecture</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">Added {i}h ago</span>
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black rounded uppercase tracking-tighter">In Progress</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-2">
                            {[1, 2].map(u => (
                              <div key={u} className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-[#16171d] flex items-center justify-center text-[8px] font-bold text-white">
                                U{u}
                              </div>
                            ))}
                          </div>
                          <MoreHorizontal size={18} className="text-[#475569] hover:text-white transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Quick Stats</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Total Items', value: '124', color: 'text-indigo-400' },
                        { label: 'Completed', value: '89', color: 'text-green-400' },
                        { label: 'Pending', value: '35', color: 'text-yellow-400' },
                      ].map((stat, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">{stat.label}</span>
                          <span className={`text-lg font-black ${stat.color}`}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 shadow-2xl shadow-indigo-500/20">
                    <Zap size={24} className="text-white mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Pro Insights</h3>
                    <p className="text-indigo-100 text-xs leading-relaxed mb-4">
                      Your team's velocity has increased by 12% this week. Keep it up!
                    </p>
                    <button className="w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm">
                      View Full Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const { localStream, remoteStreams, participants } = useWebRTC(
    socket, 
    userId, 
    userName, 
    currentChannel?.id || '', 
    workspaceId,
    isVideoActive
  );

  const applySessionIdentity = (session: any) => {
    const authUser = session?.user;
    if (!authUser?.id) {
      setIsJoined(false);
      return;
    }

    const resolvedName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'User';

    setUserId(authUser.id);
    setUserName(resolvedName);
    setIsJoined(true);
    setAuthError(null);
  };

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('workspace');
    if (!fromUrl?.trim()) return;
    setWorkspaceId(fromUrl.trim());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (!supabase) {
      setAuthError('Supabase auth is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        applySessionIdentity(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        applySessionIdentity(session);
      } else {
        setIsJoined(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isVideoActive) {
      setVideoEnabled(true);
      setAudioEnabled(true);
    }
  }, [isVideoActive]);

  useEffect(() => {
    return () => {
      if (customVideoBackgroundUrl) {
        URL.revokeObjectURL(customVideoBackgroundUrl);
      }
    };
  }, [customVideoBackgroundUrl]);

  const handleVideoBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (customVideoBackgroundUrl) {
      URL.revokeObjectURL(customVideoBackgroundUrl);
    }
    setCustomVideoBackgroundUrl(URL.createObjectURL(file));
    event.target.value = '';
  };

  const loadCommMembers = async (workspaceUuid: string) => {
    if (!supabase) return;

    const { data: memberRows, error: memberErr } = await supabase.rpc('comm_workspace_directory', {
      p_workspace_id: workspaceUuid,
    });

    if (memberErr || !memberRows) {
      if (memberErr) console.error('Error fetching comm members:', memberErr);
      return;
    }

    setCommMembers(
      (memberRows as any[]).map((row) => {
        return {
          workspace_id: row.workspace_id,
          user_id: row.user_id,
          user_name: row.display_name || row.user_id,
          email: row.email || null,
          role: row.role,
          home_workspace_id: row.default_workspace_id || null,
        };
      })
    );
  };

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

  const createCommChannel = async () => {
    if (!supabase || !supabaseWorkspaceId || !userId || !newCommChannelName.trim()) {
      setCommError('Select a workspace and enter a channel name before creating a channel.');
      return;
    }

    setIsCreatingCommChannel(true);
    setCommError(null);
    try {
      const { data, error } = await supabase.rpc('comm_create_channel', {
        p_workspace_id: supabaseWorkspaceId,
        p_name: newCommChannelName.trim(),
        p_topic: '',
        p_is_private: false,
        p_slug: null,
      });

      const conversation = Array.isArray(data) ? data[0] : data;

      if (error || !conversation) {
        console.error('Error creating channel:', error);
        setCommError(error?.message || 'Unable to create channel.');
        return;
      }

      setNewCommChannelName('');
      setCommConversationId(conversation.id);
      setCurrentChannel({
        id: conversation.id,
        workspace_id: supabaseWorkspaceId,
        name: conversation.name,
      });
      await loadCommConversations(supabaseWorkspaceId);
      await loadCommMessages(conversation.id);
    } finally {
      setIsCreatingCommChannel(false);
    }
  };

  const updateMemberRole = async (targetUserId: string, nextRole: 'owner' | 'admin' | 'employee') => {
    if (!supabase || !supabaseWorkspaceId) return;
    setRoleUpdateError(null);

    const { error } = await supabase.rpc('comm_set_member_role', {
      p_workspace_id: supabaseWorkspaceId,
      p_user_id: targetUserId,
      p_role: nextRole,
    });

    if (error) {
      setRoleUpdateError(error.message);
      return;
    }

    await loadCommMembers(supabaseWorkspaceId);
  };

  const addUserToWorkspace = async (targetUserId: string) => {
    if (!supabase || !supabaseWorkspaceId) return;
    setMemberActionError(null);
    setMemberActionUserId(targetUserId);

    try {
      const { error } = await supabase
        .from('workspace_members')
        .upsert(
          {
            workspace_id: supabaseWorkspaceId,
            user_id: targetUserId,
            role: 'employee',
          },
          { onConflict: 'workspace_id,user_id' }
        );

      if (error) {
        setMemberActionError(error.message);
        return;
      }

      await loadCommMembers(supabaseWorkspaceId);
      await loadCommPresence(supabaseWorkspaceId);
    } finally {
      setMemberActionUserId(null);
    }
  };

  const removeWorkspaceMember = async (targetUserId: string) => {
    if (!supabase || !supabaseWorkspaceId || targetUserId === userId) return;
    setMemberActionError(null);
    setMemberActionUserId(targetUserId);

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', supabaseWorkspaceId)
        .eq('user_id', targetUserId);

      if (error) {
        setMemberActionError(error.message);
        return;
      }

      await loadCommMembers(supabaseWorkspaceId);
      await loadCommPresence(supabaseWorkspaceId);
    } finally {
      setMemberActionUserId(null);
    }
  };

  const createUserFromAdminPortal = async () => {
    if (!supabaseWorkspaceId) {
      setCreateUserError('Select a workspace before creating a user.');
      return;
    }

    const emailInput = newUserEmail.trim().toLowerCase();
    const displayNameInput = newUserDisplayName.trim();
    const passwordInput = newUserPassword.trim();

    if (!emailInput || !displayNameInput) {
      setCreateUserError('Email and display name are required.');
      return;
    }

    setCreateUserError(null);
    setCreateUserSuccess(null);
    setIsCreatingWorkspaceUser(true);

    try {
      const created = await createWorkspaceUser({
        workspaceId: supabaseWorkspaceId,
        email: emailInput,
        displayName: displayNameInput,
        password: passwordInput || undefined,
        role: newUserRole,
      });

      setCreateUserSuccess(`Created ${created.displayName} (${created.email}) and added to this workspace.`);
      setNewUserEmail('');
      setNewUserDisplayName('');
      setNewUserPassword('');
      setNewUserRole('employee');

      await loadCommMembers(supabaseWorkspaceId);
      await loadCommPresence(supabaseWorkspaceId);
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Unable to create workspace user.');
    } finally {
      setIsCreatingWorkspaceUser(false);
    }
  };

  const searchUsersByName = async (query: string) => {
    if (!supabase) return;
    const term = query.trim();
    setUserSearchTerm(query);

    if (!term) {
      setUserSearchResults([]);
      setCommError(null);
      return;
    }

    setIsSearchingUsers(true);
    setCommError(null);
    try {
      const { data, error } = await supabase.rpc('comm_find_user_by_name', {
        p_name: term,
      });

      if (error) {
        console.error('Error searching users:', error);
        setCommError(error.message);
        setUserSearchResults([]);
        return;
      }

      setUserSearchResults((data || []) as Array<{ user_id: string; display_name: string; email: string | null; default_workspace_id: string | null }>);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const addUserToCurrentConversation = async (targetUserId: string, targetWorkspaceId?: string | null) => {
    if (!supabase || !commConversationId || !supabaseWorkspaceId) {
      setCommError('Open a channel before adding members.');
      return;
    }

    const workspaceForMember = targetWorkspaceId || supabaseWorkspaceId;
    const { error } = await supabase
      .from('comm_conversation_members')
      .upsert({
        conversation_id: commConversationId,
        user_id: targetUserId,
        workspace_id: workspaceForMember,
        role: 'member',
      }, { onConflict: 'conversation_id,user_id' });

    if (error) {
      console.error('Error adding member to conversation:', error);
      setCommError(error.message);
      return;
    }

    await supabase.rpc('comm_notify_user', {
      p_workspace_id: workspaceForMember,
      p_user_id: targetUserId,
      p_kind: 'added_to_channel',
      p_payload: {
        conversation_id: commConversationId,
        conversation_name: currentChannel?.name || 'channel',
        added_at: new Date().toISOString(),
      },
    });

    setCommError(null);
    await loadCommConversations(supabaseWorkspaceId);
    await loadNotifications(supabaseWorkspaceId);
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

    if (msgErr || !messageRows) {
      if (msgErr) console.error('Error fetching comm messages:', msgErr);
      return;
    }

    const senderIds = Array.from(new Set(messageRows.map((row) => row.sender_user_id)));
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', senderIds);

    const nameById = new Map((profileRows || []).map((row) => [row.id, row.display_name || row.id]));

    const mapped = messageRows.map((row: any) => {
      const attachments = Array.isArray(row.attachments) ? row.attachments : [];
      const firstAttachment = attachments[0] || null;
      return {
        id: row.id,
        userId: row.sender_user_id,
        userName: nameById.get(row.sender_user_id) || row.sender_user_id,
        text: row.body,
        file_url: firstAttachment?.url,
        file_name: firstAttachment?.name,
        file_type: firstAttachment?.type,
        timestamp: new Date(row.created_at).getTime(),
      } as ChatMessage;
    });

    setMessages(mapped);

    if (supabaseWorkspaceId && userId) {
      const { data: unreadRows } = await supabase
        .from('comm_notifications')
        .select('id')
        .eq('workspace_id', supabaseWorkspaceId)
        .eq('user_id', userId)
        .is('read_at', null)
        .contains('payload', { conversation_id: conversationId })
        .limit(200);

      if (unreadRows?.length) {
        const now = new Date().toISOString();
        await supabase
          .from('comm_notifications')
          .update({ read_at: now })
          .in('id', unreadRows.map((row) => row.id));
      }
    }
  };

  const loadCommPresence = async (workspaceUuid: string) => {
    if (!supabase) return;

    try {
      const snapshot = await getCommunicationPresenceSnapshot({ workspaceId: workspaceUuid });
      setWorkspacePresence(
        snapshot.members.map((member) => ({
          userId: member.userId,
          userName: member.userName,
          role: member.role,
          online: member.online,
          status: member.status,
          lastActiveAt: member.lastActiveAt ? new Date(member.lastActiveAt).getTime() : null,
        }))
      );
    } catch (error) {
      console.error('Error fetching comm presence snapshot:', error);
    }
  };

  const sendPresenceHeartbeat = async (workspaceUuid: string, status: PresenceOptionValue) => {
    try {
      await heartbeatCommunicationPresence({ workspaceId: workspaceUuid, status });
    } catch (error) {
      console.error('Error sending presence heartbeat:', error);
    }
  };

  const loadNotifications = async (workspaceUuid: string) => {
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from('comm_notifications')
      .select('id,user_id,workspace_id,kind,payload,read_at,created_at')
      .eq('workspace_id', workspaceUuid)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading notifications:', error);
      return;
    }

    setNotifications((data || []) as ReachNotification[]);
  };

  const loadIssueActivity = async (workspaceUuid: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('issue_activity')
      .select('id,issue_key,action,summary,actor_user_id,created_at')
      .eq('workspace_id', workspaceUuid)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading issue activity:', error);
      return;
    }

    setActivityItems((data || []) as IssueActivityItem[]);
  };

  const scheduleMeeting = async () => {
    if (!supabaseWorkspaceId || !meetingTitle.trim() || !meetingWhen) {
      setMeetingError('Meeting title and time are required.');
      return;
    }

    setMeetingError(null);
    try {
      const { meetingId } = await scheduleCommunicationMeeting({
        workspaceId: supabaseWorkspaceId,
        title: meetingTitle.trim(),
        scheduledFor: new Date(meetingWhen).toISOString(),
        participantIds: meetingParticipantIds,
        conversationId: commConversationId || undefined,
      });

      if (supabase) {
        for (const participantId of meetingParticipantIds) {
          await supabase.rpc('comm_notify_user', {
            p_workspace_id: supabaseWorkspaceId,
            p_user_id: participantId,
            p_kind: 'meeting_invite',
            p_payload: {
              meeting_id: meetingId,
              title: meetingTitle.trim(),
              scheduled_for: new Date(meetingWhen).toISOString(),
              conversation_id: commConversationId,
            },
          });
        }
      }

      setMeetingTitle('');
      setMeetingWhen('');
      setMeetingParticipantIds([]);
      setIsMeetingModalOpen(false);
      await loadNotifications(supabaseWorkspaceId);
    } catch (error: any) {
      setMeetingError(error?.message || 'Unable to schedule meeting.');
    }
  };

  const respondMeeting = async (meetingId: string, response: 'accepted' | 'declined' | 'tentative') => {
    try {
      await respondToCommunicationMeeting({ meetingId, response });
      if (supabaseWorkspaceId) {
        await loadNotifications(supabaseWorkspaceId);
      }
    } catch (error) {
      console.error('Error responding to meeting:', error);
    }
  };

  const ensureCommConversation = async (workspaceUuid: string) => {
    if (!supabase || !userId) return;

    const { data: existing, error: existingErr } = await supabase
      .from('comm_conversations')
      .select('id,name')
      .eq('workspace_id', workspaceUuid)
      .eq('kind', 'channel')
      .eq('slug', 'general')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error('Error checking conversation:', existingErr);
      return;
    }

    let conversationId = existing?.id as string | null;
    if (!conversationId) {
      const { data: created, error: createErr } = await supabase
        .from('comm_conversations')
        .insert({
          workspace_id: workspaceUuid,
          kind: 'channel',
          name: 'general',
          slug: 'general',
          topic: 'Workspace default channel',
          created_by: userId,
        })
        .select('id,name')
        .single();

      if (createErr || !created) {
        console.error('Error creating conversation:', createErr);
        return;
      }
      conversationId = created.id;
    }

    const { error: memberErr } = await supabase
      .from('comm_conversation_members')
      .upsert({
        conversation_id: conversationId,
        user_id: userId,
        workspace_id: workspaceUuid,
        role: 'owner',
      }, { onConflict: 'conversation_id,user_id' });

    if (memberErr) {
      console.error('Error syncing conversation member:', memberErr);
    }

    setCommConversationId(conversationId);
    setCurrentChannel({
      id: conversationId,
      workspace_id: workspaceUuid,
      name: existing?.name || 'general',
    });
  };

  const loadSupabaseCommunicationContext = async () => {
    if (!supabase || !userId) return;

    const preferredSlug = workspaceId?.trim() || null;
    const { data: bootRows, error: bootstrapErr } = await supabase.rpc('comm_bootstrap_workspace_context', {
      p_preferred_slug: preferredSlug,
    });

    if (bootstrapErr) {
      console.error('Error bootstrapping workspace context:', bootstrapErr);
    }

    const normalizedBootRows = (bootRows || []) as Array<{ id: string; name: string; slug: string; is_default: boolean }>;
    if (normalizedBootRows.length > 0) {
      const choices = normalizedBootRows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
      setWorkspaceChoices(choices);
      const chosen = normalizedBootRows.find((row) => row.is_default) || normalizedBootRows[0];
      setSupabaseWorkspaceId(chosen.id);
      if (chosen.slug) setWorkspaceId(chosen.slug);
      return;
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('default_workspace_id')
      .eq('id', userId)
      .maybeSingle();

    const { data: memberships, error: membershipErr } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    if (membershipErr || !memberships?.length) {
      if (membershipErr) console.error('Error fetching workspace memberships:', membershipErr);
      return;
    }

    const workspaceIds = memberships.map((m) => m.workspace_id);
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id,name,slug')
      .in('id', workspaceIds);

    if (workspaces?.length) {
      setWorkspaceChoices(workspaces);
    }

    const chosenWorkspace =
      profileRow?.default_workspace_id && workspaceIds.includes(profileRow.default_workspace_id)
        ? profileRow.default_workspace_id
        : workspaceIds[0];

    setSupabaseWorkspaceId(chosenWorkspace);
    const chosenRecord = (workspaces || []).find((w) => w.id === chosenWorkspace);
    if (chosenRecord?.slug) {
      setWorkspaceId(chosenRecord.slug);
    }
  };


  useEffect(() => {
    if (!isJoined || !userId) return;
    loadSupabaseCommunicationContext().catch((err) => {
      console.error('Error initializing communication context:', err);
    });
  }, [isJoined, userId]);

  useEffect(() => {
    if (!supabaseWorkspaceId || !isJoined) return;
    ensureCommConversation(supabaseWorkspaceId).catch((err) => {
      console.error('Error ensuring default conversation:', err);
    });
    loadCommConversations(supabaseWorkspaceId).catch((err) => {
      console.error('Error loading conversations:', err);
    });
    loadCommMembers(supabaseWorkspaceId).catch((err) => {
      console.error('Error loading communication members:', err);
    });
  }, [supabaseWorkspaceId, isJoined, userId]);

  useEffect(() => {
    if (!supabaseWorkspaceId || !isJoined) return;
    sendPresenceHeartbeat(supabaseWorkspaceId, myStatus).catch(() => {});
    loadCommPresence(supabaseWorkspaceId).catch((err) => {
      console.error('Error loading communication presence:', err);
    });
    loadNotifications(supabaseWorkspaceId).catch(() => {});
    loadIssueActivity(supabaseWorkspaceId).catch(() => {});

    const timer = setInterval(() => {
      sendPresenceHeartbeat(supabaseWorkspaceId, myStatus).catch(() => {});
      loadCommPresence(supabaseWorkspaceId).catch(() => {});
      loadNotifications(supabaseWorkspaceId).catch(() => {});
      loadIssueActivity(supabaseWorkspaceId).catch(() => {});
    }, 12000);

    return () => clearInterval(timer);
  }, [supabaseWorkspaceId, isJoined, commMembers, myStatus]);

  useEffect(() => {
    if (!supabase || !commConversationId) return;

    loadCommMessages(commConversationId).catch((err) => {
      console.error('Error loading communication messages:', err);
    });

    const messageChannel = supabase
      .channel(`comm-messages-${commConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comm_messages',
          filter: `conversation_id=eq.${commConversationId}`,
        },
        () => {
          loadCommMessages(commConversationId).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [commConversationId, supabase, commMembers]);

  useEffect(() => {
    if (!supabase || !supabaseWorkspaceId) return;

    const presenceChannel = supabase
      .channel(`comm-presence-${supabaseWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comm_presence',
          filter: `workspace_id=eq.${supabaseWorkspaceId}`,
        },
        () => {
          loadCommPresence(supabaseWorkspaceId).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [supabaseWorkspaceId, supabase, commMembers]);

  useEffect(() => {
    const key = commConversationId || currentChannel?.id;
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(`reach:pins:${key}`);
      setPinnedMessageIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setPinnedMessageIds([]);
    }
  }, [commConversationId, currentChannel?.id]);

  const togglePinMessage = (messageId: string) => {
    const key = commConversationId || currentChannel?.id;
    if (!key) return;

    setPinnedMessageIds((prev) => {
      const next = prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId];
      window.localStorage.setItem(`reach:pins:${key}`, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const shouldUseLocalSocket = isVideoActive;
    if (isJoined && currentChannel && shouldUseLocalSocket) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join',
          payload: { workspaceId, roomId: currentChannel.id, userId, userName }
        }));
      };

      setSocket(ws);
      return () => ws.close();
    }
  }, [isJoined, currentChannel, userId, userName, workspaceId, isVideoActive]);

  const uploadCommunicationAsset = async (file: File) => {
    if (!supabase || !supabaseWorkspaceId) {
      throw new Error('Workspace context is required before uploading files.');
    }

    const targetConversationId = commConversationId || currentChannel?.id;
    if (!targetConversationId) {
      throw new Error('Open a conversation before uploading files.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${supabaseWorkspaceId}/${targetConversationId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('comm-uploads')
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from('comm-uploads').getPublicUrl(objectPath);
    return {
      url: urlData.publicUrl,
      name: file.name,
      type: file.type,
    };
  };

  const emitPresence = (status: PresenceOptionValue) => {
    if (supabaseWorkspaceId) {
      setCommunicationPresence({
        workspaceId: supabaseWorkspaceId,
        status,
      }).catch((err) => {
        console.error('Error setting communication presence:', err);
      });
      return;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'presence',
        payload: { status },
      }));
    }
  };

  const handleSetStatus = (status: PresenceOptionValue) => {
    setMyStatus(status);
    setShowStatusMenu(false);
    emitPresence(status);
  };

  useEffect(() => {
    if (!socket) return;

    const sendCurrent = () => {
      emitPresence(myStatus);
    };

    if (socket.readyState === WebSocket.OPEN) {
      sendCurrent();
      return;
    }

    socket.addEventListener('open', sendCurrent);
    return () => socket.removeEventListener('open', sendCurrent);
  }, [socket, myStatus, supabaseWorkspaceId]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        emitPresence(myStatus);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [socket, myStatus, supabaseWorkspaceId]);

  useEffect(() => {
    if (!showStatusMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showStatusMenu]);

  const presenceByUserId = new Map<string, WorkspacePresence>(
    workspacePresence.map((presence): [string, WorkspacePresence] => [presence.userId, presence])
  );
  const onlineCount = workspacePresence.filter((presence) => presence.online).length || (participants.length + 1);
  const panelMembers = commMembers.length
    ? commMembers
    : workspace?.members?.length
    ? workspace.members
    : [{ workspace_id: workspaceId, user_id: userId, user_name: userName || 'You', role: 'employee' }];
  const onlineMembers = panelMembers.filter((member) => {
    const status = presenceByUserId.get(member.user_id)?.status || 'offline';
    return status === 'online' || status === 'available' || status === 'out_of_office';
  });
  const currentMemberRole = panelMembers.find((member) => member.user_id === userId)?.role || 'employee';
  const isAdminUser = currentMemberRole === 'owner' || currentMemberRole === 'admin';
  const channelConversations = commConversations.filter((conversation) => conversation.kind === 'channel');
  const directConversations = commConversations.filter((conversation) => conversation.kind !== 'channel');
  const filteredNewChannelMembers = panelMembers
    .filter((member) => member.user_id !== userId)
    .filter((member) => {
      const query = newChannelMemberSearch.trim().toLowerCase();
      if (!query) return true;
      const memberName = (member.user_name || '').toLowerCase();
      const memberEmail = String((member as any).email || '').toLowerCase();
      const memberId = String(member.user_id || '').toLowerCase();
      return memberName.includes(query) || memberEmail.includes(query) || memberId.includes(query);
    });
  const unreadNotifications = notifications.filter((item) => !item.read_at);

  const unreadCountByConversation = unreadNotifications.reduce<Record<string, number>>((acc, item) => {
    const conversationId = item.payload?.conversation_id;
    if (typeof conversationId === 'string' && conversationId) {
      acc[conversationId] = (acc[conversationId] || 0) + 1;
    }
    return acc;
  }, {});

  const handleSendMessage = (text?: string, fileData?: any) => {
    if (!commConversationId || !(text?.trim() || fileData)) {
      setCommError('Open a channel or DM before sending a message.');
      return;
    }

    if (!supabaseWorkspaceId) {
      setCommError('Communication workspace is not initialized.');
      return;
    }

    setCommError(null);
    const attachments = fileData ? [{
      url: fileData.url,
      name: fileData.name,
      type: fileData.type,
    }] : [];

    const input = text?.trim() || '';
    const body = input || (fileData?.name ? `Shared file: ${fileData.name}` : 'Shared attachment');

    const sender = input.startsWith('/')
      ? routeCommunicationCommand({
          workspaceId: supabaseWorkspaceId,
          conversationId: commConversationId,
          input,
        })
      : sendCommunicationMessage({
          conversationId: commConversationId,
          body,
          attachments,
        });

    sender
      .then(() => loadCommMessages(commConversationId))
      .catch((err) => {
        console.error('Error sending communication message:', err);
        setCommError(err?.message || 'Failed to send communication message.');
      });
  };

  const openCreateChannelWizard = () => {
    setNewChannelName('');
    setNewChannelVisibility('public');
    setNewChannelMemberIds([]);
    setNewChannelMemberSearch('');
    setCreateChannelStep(1);
    setShowCreateChannel(true);
    setCommError(null);
  };

  const closeCreateChannelWizard = () => {
    setShowCreateChannel(false);
    setCreateChannelStep(1);
    setNewChannelVisibility('public');
    setNewChannelMemberSearch('');
  };

  const toggleChannelWizardMember = (targetUserId: string) => {
    setNewChannelMemberIds((prev) => (
      prev.includes(targetUserId)
        ? prev.filter((id) => id !== targetUserId)
        : [...prev, targetUserId]
    ));
  };

  const handleCreateChannel = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase) {
      setCommError('Supabase client is not available. Check environment configuration.');
      return;
    }
    if (!supabaseWorkspaceId) {
      setCommError('Select a workspace before creating a channel.');
      return;
    }
    if (!newChannelName.trim()) {
      setCommError('Enter a channel name before submitting.');
      return;
    }

    setIsCreatingCommChannel(true);
    setCommError(null);
    try {
      const { data, error } = await supabase.rpc('comm_create_channel', {
        p_workspace_id: supabaseWorkspaceId,
        p_name: newChannelName.trim(),
        p_topic: '',
        p_is_private: newChannelVisibility === 'private',
        p_slug: null,
      });

      if (error) {
        throw error;
      }

      const channel = Array.isArray(data) ? data[0] : data;
      if (!channel?.id) {
        throw new Error('Channel was not returned by comm_create_channel');
      }

      setNewChannelName('');
      setShowCreateChannel(false);
      setCreateChannelStep(1);
      setNewChannelVisibility('public');
      setCurrentChannel(channel);
      setCommConversationId(channel.id);
      setActiveSidebarItem('messages');

      // Optimistically place created conversation into sidebar state immediately.
      setCommConversations((prev) => {
        const exists = prev.some((conversation) => conversation.id === channel.id);
        if (exists) return prev;
        return [
          {
            id: channel.id,
            name: channel.name,
            kind: channel.kind || 'channel',
            workspace_id: channel.workspace_id || supabaseWorkspaceId,
          },
          ...prev,
        ];
      });

      const inviteeIds = Array.from(new Set(
        newChannelMemberIds.filter((candidateId) => candidateId && candidateId !== userId)
      ));

      if (inviteeIds.length > 0) {
        const { error: addMembersError } = await supabase
          .from('comm_conversation_members')
          .upsert(
            inviteeIds.map((inviteeId) => ({
              conversation_id: channel.id,
              user_id: inviteeId,
              workspace_id: supabaseWorkspaceId,
              role: 'member',
            })),
            { onConflict: 'conversation_id,user_id' }
          );

        if (addMembersError) {
          throw addMembersError;
        }

        await Promise.all(
          inviteeIds.map(async (inviteeId) => {
            try {
              await supabase.rpc('comm_notify_user', {
                p_workspace_id: supabaseWorkspaceId,
                p_user_id: inviteeId,
                p_kind: 'added_to_channel',
                p_payload: {
                  conversation_id: channel.id,
                  conversation_name: channel.name,
                  added_by: userId,
                },
              });
            } catch (notifyError) {
              console.warn('Unable to send channel invite notification:', notifyError);
            }
          })
        );
      }

      setNewChannelMemberIds([]);
      setNewChannelMemberSearch('');
      await loadCommConversations(supabaseWorkspaceId);
      await loadCommMessages(channel.id);
    } catch (err) {
      console.error("Error creating channel:", err);
      setCommError(err instanceof Error ? err.message : 'Unable to create channel.');
    } finally {
      setIsCreatingCommChannel(false);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
      setVideoEnabled(!videoEnabled);
    } else {
      setMediaError("Camera not accessible. Please check permissions.");
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !audioEnabled);
      setAudioEnabled(!audioEnabled);
    } else {
      setMediaError("Microphone not accessible. Please check permissions.");
    }
  };

  const toggleStandup = () => {
    setIsVideoActive((prev) => !prev);
  };

  const terminateHuddle = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    if (screenShareStream) {
      screenShareStream.getTracks().forEach((track) => track.stop());
      setScreenShareStream(null);
    }
    setVideoEnabled(false);
    setAudioEnabled(false);
    setIsVideoActive(false);
    setMediaError(null);
  };

  const toggleScreenShare = async () => {
    if (screenShareStream) {
      screenShareStream.getTracks().forEach((track) => track.stop());
      setScreenShareStream(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          setScreenShareStream(null);
        });
      }
      setScreenShareStream(stream);
    } catch (error) {
      console.error('Screen share unavailable:', error);
      setMediaError('Unable to start screen share.');
    }
  };

  const launchCall = () => {
    if (callMode === 'channel') {
      setActiveSidebarItem('huddle');
      setIsVideoActive(true);
      setShowCallLauncher(false);
      return;
    }

    if (callMode === 'team') {
      const teamChannel = workspace?.channels?.find((channel) => channel.team_id === selectedTeamCallId) || workspace?.channels?.[0] || currentChannel;
      if (teamChannel) {
        setCurrentChannel(teamChannel);
      }
      setActiveSidebarItem('huddle');
      setIsVideoActive(true);
      setShowCallLauncher(false);
      return;
    }

    if (callMode === 'member') {
      const memberId = selectedCallMemberIds[0];
      const target = panelMembers.find((member) => member.user_id === memberId);
      if (!target) return;
      startPrivateCall({
        id: target.user_id,
        name: target.user_name,
        roomId: currentChannel?.id || 'general',
        workspaceId: (target as any).home_workspace_id || target.workspace_id || workspaceId,
      });
      setActiveSidebarItem('huddle');
      setIsVideoActive(true);
      setShowCallLauncher(false);
      return;
    }

    if (callMode === 'group') {
      if (!selectedCallMemberIds.length) return;
      const roomName = selectedCallMemberIds
        .map((id) => panelMembers.find((member) => member.user_id === id)?.user_name || id)
        .slice(0, 2)
        .join(', ');

      setCurrentChannel({
        id: `group-call-${[userId, ...selectedCallMemberIds].sort().join('-')}`,
        workspace_id: workspaceId,
        name: `Group: ${roomName}`,
      });
      setMessages([]);
      setActiveSidebarItem('huddle');
      setIsVideoActive(true);
      setShowCallLauncher(false);
    }
  };

  const uploadHuddleAsset = async (file: File) => {
    setIsHuddleUploading(true);
    try {
      const data = await uploadCommunicationAsset(file);
      handleSendMessage(`Shared during huddle: ${file.name}`, data);
    } catch (error) {
      console.error('Failed to upload huddle asset:', error);
      setCommError(error instanceof Error ? error.message : 'Failed to upload huddle asset.');
    } finally {
      setIsHuddleUploading(false);
    }
  };

  const handleHuddleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadHuddleAsset(file);
    event.target.value = '';
  };

  const handleHeaderVideoClick = () => {
    if (!isVideoActive) {
      setIsVideoActive(true);
      return;
    }
    toggleVideo();
  };

  const handleComposerVideoClick = () => {
    if (!isVideoActive) {
      setIsVideoActive(true);
      setActiveSidebarItem('huddle');
      return;
    }
    toggleVideo();
  };

  const goToCoreView = (globalId: string, sidebarId: string) => {
    setActiveGlobalNav(globalId);
    setActiveSidebarItem(sidebarId);
  };

  const startPrivateCall = (user: User) => {
    if (user.id === userId) return;

    if (!supabaseWorkspaceId) {
      // Fallback for local test mode.
      const privateRoomId = [userId, user.id].sort().join('--');
      setCurrentChannel({
        id: privateRoomId,
        workspace_id: workspaceId,
        name: `DM: ${user.name}`,
      });
      setMessages([]);
      return;
    }

    openDirectMessage({
      workspaceId: supabaseWorkspaceId,
      targetUserId: user.id,
      targetWorkspaceId: user.workspaceId || undefined,
    })
      .then((result) => {
        setCommError(null);
        setCommConversationId(result.conversationId);
        setCurrentChannel({
          id: result.conversationId,
          workspace_id: supabaseWorkspaceId,
          name: `DM: ${user.name}`,
        });
        return loadCommMessages(result.conversationId);
      })
      .catch((err) => {
        console.error('Error opening direct conversation:', err);
        setCommError(err?.message || 'Unable to open direct message conversation.');
      });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (!supabase) {
      setAuthError('Supabase auth is not configured.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isSignUpMode) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: email.trim().split('@')[0],
            },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGitHubAuth = async () => {
    if (!supabase) {
      setAuthError('Supabase auth is not configured.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) {
      setIsJoined(false);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }

    setSupabaseWorkspaceId(null);
    setWorkspaceChoices([]);
    setCommConversationId(null);
    setCommConversations([]);
    setCommMembers([]);
    setWorkspacePresence([]);
    setMessages([]);
    setCurrentChannel(null);
    setIsJoined(false);
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#1a1d21] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#222529] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-[#303236]"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Video className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome to REACH</h1>
          <p className="text-gray-400 text-center mb-8">Sign in to your isolated workspace</p>

          <form onSubmit={handleAuthSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  autoFocus
                />
              </div>
              {authError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {authError}
                </div>
              )}
              <button 
                type="submit"
                disabled={!email || !password || authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                {authLoading ? 'Please wait...' : isSignUpMode ? 'Create Account' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={handleGitHubAuth}
                disabled={authLoading}
                className="w-full bg-[#1a1d21] border border-[#303236] hover:border-indigo-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                Continue with GitHub
              </button>

              <button
                type="button"
                onClick={() => setIsSignUpMode((prev) => !prev)}
                className="w-full text-xs text-[#94a3b8] hover:text-white transition-colors"
              >
                {isSignUpMode ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            </div>
          </form>
          <div className="mt-6 pt-6 border-t border-[#303236] text-center text-xs text-[#64748b]">
            Supabase-backed workspace messaging is active.
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0e12] flex overflow-hidden font-sans text-[#e2e8f0]">
      {/* Global Navigation Sidebar (Far Left) */}
      <nav className="w-[72px] bg-[#16171d] border-r border-[#26272e] flex flex-col items-center py-4 flex-shrink-0 z-30">
        <button
          onClick={() => {
            setActiveGlobalNav('issues');
            setActiveSidebarItem('assigned-to-me');
          }}
          className="w-10 h-10 bg-[#1f2130] rounded-xl flex items-center justify-center mb-6 border border-[#2c2f3b] text-[#cbd5e1] hover:text-white hover:bg-[#26272e] transition-all"
          aria-label="Go to Home"
        >
          <Home className="w-5 h-5" />
        </button>
        <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar w-full items-center">
          {NEW_GLOBAL_NAV.map((item) => (
            <div key={item.id} className="group relative">
              <button 
                onClick={() => {
                  setActiveGlobalNav(item.id);
                  const firstChild = (NAVIGATION_TREE as any)[item.id]?.[0];
                  if (firstChild) {
                    setActiveSidebarItem(firstChild.id);
                  }
                }}
                className={`p-2.5 rounded-xl transition-all relative ${
                  activeGlobalNav === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]'
                }`}
              >
                <item.icon size={22} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-4 items-center">
          <button
            onClick={() => goToCoreView('members', 'all-members')}
            className="p-2.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-xl transition-all"
            title="Admin portal"
          >
            <Settings size={22} />
          </button>
          <button className="p-2.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-xl transition-all">
            <Plus size={22} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 text-[#94a3b8] hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-all"
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-[#0d0e12]">
        {/* Top Header Bar */}
        <header className="h-[64px] border-b border-[#26272e] flex items-center justify-between px-6 bg-[#0d0e12] z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white text-sm tracking-[0.08em] uppercase">
              {NEW_GLOBAL_NAV.find(n => n.id === activeGlobalNav)?.label || activeGlobalNav}
            </h3>
            {workspaceChoices.length > 0 && (
              <select
                value={supabaseWorkspaceId || ''}
                onChange={(e) => setSupabaseWorkspaceId(e.target.value || null)}
                className="bg-[#16171d] border border-[#26272e] text-[#cbd5e1] rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Communication workspace"
              >
                {workspaceChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.name} ({choice.slug})</option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div ref={statusMenuRef} className="relative">
              <button
                onClick={() => setShowStatusMenu((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#16171d] border border-[#26272e] rounded-xl text-[#94a3b8] hover:text-white transition-all"
              >
                <Users size={16} />
                <span className="text-xs font-bold">{onlineCount}</span>
                <span className={`w-2 h-2 rounded-full ${getStatusDotClass(myStatus)}`} />
                <ChevronDown size={14} className={`transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
              </button>

              {showStatusMenu && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-[#16171d] border border-[#26272e] rounded-xl shadow-2xl z-30 p-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Set your status</p>
                  <div className="space-y-1">
                    {PRESENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSetStatus(option.value)}
                        className={`w-full text-left px-2 py-2 rounded-lg flex items-start gap-2 transition-all ${
                          myStatus === option.value
                            ? 'bg-indigo-600/20 border border-indigo-500/30'
                            : 'hover:bg-[#26272e] border border-transparent'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full mt-1.5 ${getStatusDotClass(option.value)}`} />
                        <span>
                          <span className="block text-xs font-semibold text-white">{option.label}</span>
                          <span className="block text-[10px] text-[#94a3b8]">{option.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5 bg-[#16171d] border border-[#26272e] rounded-xl px-1.5 py-1">
              <button onClick={() => goToCoreView('issues', 'following')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="Favorite view">
                <Star size={16} />
              </button>
              <button onClick={() => goToCoreView('code-prs', 'pull-requests')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="IDE page">
                <Code2 size={16} />
              </button>
              <button onClick={() => goToCoreView('time-tracker', 'active-timer')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="Time clock management">
                <Clock size={16} />
              </button>
              <button onClick={() => goToCoreView('chat', 'files')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="Docs page">
                <FileText size={16} />
              </button>
              <button onClick={() => goToCoreView('chat', 'messages')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="Chat page">
                <MessageSquare size={16} />
              </button>
              <button onClick={() => goToCoreView('members', 'all-members')} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" aria-label="User profile settings">
                <Settings size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={toggleStandup}
                className={`p-2 rounded-xl transition-all ${isVideoActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]'}`}
              >
                <Headphones size={20} />
              </button>
              <button
                onClick={handleHeaderVideoClick}
                className={`p-2 rounded-xl transition-all ${isVideoActive && videoEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]'}`}
              >
                <Video size={20} />
              </button>
              {isVideoActive && (
                <button
                  onClick={terminateHuddle}
                  className="px-3 py-2 bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
                  title="Terminate UPS and release camera/microphone"
                >
                  End UPS
                </button>
              )}
            </div>
            <div className="h-6 w-px bg-[#26272e]" />
            <div className="flex items-center bg-[#16171d] border border-[#26272e] rounded-xl px-3 py-1.5 gap-2">
              <Search size={16} className="text-[#94a3b8]" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none text-xs text-white focus:outline-none w-48" />
            </div>
          </div>
        </header>

        {/* Page-Level Navigation Row */}
        {activeGlobalNav === 'chat' ? (
          <div className="border-b border-[#26272e] px-6 py-2.5 bg-[#0d0e12] space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {topBarTabs.map((tab: any) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSidebarItem(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                      activeSidebarItem === tab.id
                        ? 'bg-[#26272e] text-white'
                        : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={commConversationId || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  const conversation = commConversations.find((item) => item.id === id);
                  if (!conversation) return;
                  setCommConversationId(conversation.id);
                  setCurrentChannel({
                    id: conversation.id,
                    workspace_id: conversation.workspace_id || supabaseWorkspaceId || workspaceId,
                    name: conversation.name,
                  });
                }}
                className="bg-[#16171d] border border-[#303236] text-white rounded-lg px-2.5 py-1.5 text-xs"
              >
                <option value="">Select channel/DM</option>
                {commConversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.kind === 'channel' ? `# ${conversation.name}` : conversation.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowCallLauncher(true)}
                className="bg-[#26272e] hover:bg-[#303236] text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                title="Start call"
              >
                + Call
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <input
                value={userSearchTerm}
                onChange={(e) => searchUsersByName(e.target.value)}
                placeholder="Find teammate by name or email"
                className="bg-[#16171d] border border-[#303236] text-white rounded-lg px-2.5 py-1.5 text-xs w-full max-w-sm"
              />
              {userSearchTerm.trim() && (
                <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                  {isSearchingUsers && <p className="text-[10px] text-[#64748b]">Searching users...</p>}
                  {!isSearchingUsers && userSearchResults.map((result) => (
                    <div key={result.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[#16171d] rounded border border-[#303236] max-w-2xl">
                      <span className="text-xs text-white truncate">{result.display_name || result.email || result.user_id}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startPrivateCall({
                            id: result.user_id,
                            name: result.display_name || result.email || 'User',
                            roomId: currentChannel?.id || 'general',
                            workspaceId: result.default_workspace_id || workspaceId,
                          })}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1 text-[10px] font-semibold"
                        >
                          Open DM
                        </button>
                        {commConversationId && (
                          <button
                            onClick={() => addUserToCurrentConversation(result.user_id, result.default_workspace_id)}
                            className="bg-[#26272e] hover:bg-[#303236] text-white rounded px-2 py-1 text-[10px] font-semibold"
                          >
                            Add to Channel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[44px] border-b border-[#26272e] flex items-center px-6 bg-[#0d0e12]">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
              {topBarTabs.map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSidebarItem(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                    activeSidebarItem === tab.id
                      ? 'bg-[#26272e] text-white'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all flex-shrink-0">
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Content Surface */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Video Overlay / Grid */}
            <AnimatePresence>
              {isVideoActive && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '300px', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-[#0d0e12] border-b border-[#26272e] p-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCallLauncher(true)}
                        className="px-3 py-1.5 rounded-lg border border-[#303236] bg-[#16171d] text-xs text-white hover:bg-[#26272e]"
                      >
                        + Add to Call
                      </button>
                      <label className="px-3 py-1.5 rounded-lg border border-[#303236] bg-[#16171d] text-xs text-white hover:bg-[#26272e] cursor-pointer">
                        + Share File
                        <input type="file" className="hidden" onChange={handleHuddleFileInput} />
                      </label>
                    </div>
                    <button
                      onClick={() => setIsVideoSettingsOpen((prev) => !prev)}
                      className="p-2 rounded-lg border border-[#303236] bg-[#16171d] text-[#cbd5e1] hover:bg-[#26272e]"
                      title="Video settings"
                    >
                      <Settings size={16} />
                    </button>
                  </div>

                  {isVideoSettingsOpen && (
                    <div className="mb-3 bg-[#16171d] border border-[#26272e] rounded-xl p-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-[#cbd5e1]">
                        <input
                          type="checkbox"
                          checked={isBackgroundBlurEnabled}
                          onChange={(e) => setIsBackgroundBlurEnabled(e.target.checked)}
                        />
                        Blur background
                      </label>
                      <label className="text-xs text-[#cbd5e1] px-2 py-1 rounded border border-[#303236] cursor-pointer hover:bg-[#26272e]">
                        Upload background
                        <input type="file" accept="image/*" className="hidden" onChange={handleVideoBackgroundUpload} />
                      </label>
                      {customVideoBackgroundUrl && (
                        <button
                          onClick={() => setCustomVideoBackgroundUrl(null)}
                          className="text-xs text-red-200 px-2 py-1 rounded border border-red-500/40 bg-red-500/10"
                        >
                          Remove background
                        </button>
                      )}
                    </div>
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsHuddleDragging(true);
                    }}
                    onDragLeave={() => setIsHuddleDragging(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsHuddleDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        await uploadHuddleAsset(file);
                      }
                    }}
                    className={`mb-3 px-3 py-2 rounded-lg border text-xs ${
                      isHuddleDragging
                        ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200'
                        : 'border-[#303236] bg-[#16171d] text-[#94a3b8]'
                    }`}
                  >
                    {isHuddleUploading ? 'Uploading shared asset...' : 'Drag and drop documents or visuals into this UPS'}
                  </div>

                  <div className="flex gap-4 h-full overflow-x-auto custom-scrollbar pb-2">
                    {screenShareStream && (
                      <div className="w-64 flex-shrink-0">
                        <VideoCard stream={screenShareStream} name="Shared Screen" />
                      </div>
                    )}
                    <div className="w-64 flex-shrink-0">
                      <VideoCard
                        stream={localStream}
                        name={`${userName} (You)`}
                        isLocal
                        muted
                        blurBackground={isBackgroundBlurEnabled}
                        backgroundImageUrl={customVideoBackgroundUrl}
                      />
                    </div>
                    {Array.from(remoteStreams.entries()).map(([id, stream]) => {
                      const participant = participants.find(p => p.id === id);
                      return (
                        <div key={id} className="w-64 flex-shrink-0">
                          <VideoCard stream={stream} name={participant?.name || 'User'} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center mt-4 gap-3">
                    <ControlButton 
                      onClick={toggleAudio} 
                      active={audioEnabled} 
                      icon={audioEnabled ? Mic : MicOff} 
                      label={audioEnabled ? 'Mute' : 'Unmute'}
                    />
                    <ControlButton 
                      onClick={toggleVideo} 
                      active={videoEnabled} 
                      icon={videoEnabled ? Video : VideoOff} 
                      label={videoEnabled ? 'Stop Video' : 'Start Video'}
                    />
                    <ControlButton
                      onClick={toggleScreenShare}
                      active={!screenShareStream}
                      icon={Monitor}
                      label={screenShareStream ? 'Stop Share' : 'Share'}
                    />
                    <ControlButton
                      onClick={() => setShowCallLauncher(true)}
                      icon={UserPlus}
                      label="Add"
                    />
                    <button 
                      onClick={terminateHuddle}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 text-xs"
                    >
                      <LogOut size={16} />
                      End Call
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Render Content based on activeSidebarItem */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {renderContent()}
            </div>
          </div>

          {/* Right Panel (Details & Threads) */}
          <AnimatePresence>
            {isChatOpen && activeGlobalNav === 'chat' && (
              <motion.section
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="bg-[#16171d] border-l border-[#26272e] flex flex-col flex-shrink-0 z-10"
              >
                <div className="h-[64px] border-b border-[#26272e] flex items-center justify-between px-6">
                  <h3 className="font-bold text-white text-lg tracking-tight">Details</h3>
                  <button onClick={() => setIsChatOpen(false)} className="text-[#94a3b8] hover:text-white p-1.5 hover:bg-[#26272e] rounded-lg transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="px-6 py-4 border-b border-[#26272e] bg-[#0d0e12] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Thread Focus</p>
                    <p className="text-xs text-[#94a3b8] mt-1">Use this panel for context, not channel-wide composing.</p>
                  </div>
                  <select
                    value={myStatus}
                    onChange={(e) => handleSetStatus(e.target.value as PresenceOptionValue)}
                    className="bg-[#16171d] border border-[#303236] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PRESENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div>
                    <h4 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-3">About Channel</h4>
                    <div className="bg-[#0d0e12] rounded-xl p-4 border border-[#26272e]">
                      <p className="text-sm text-white font-bold mb-1">#{currentChannel?.name || 'general'}</p>
                      <p className="text-xs text-[#94a3b8] leading-relaxed">Thread replies belong to a specific message. The center column remains the main stream.</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">Members</h4>
                      <span className="text-[10px] font-bold text-indigo-400">{onlineCount}</span>
                    </div>
                    <div className="space-y-2">
                      {onlineMembers.map((member) => {
                        const presence = presenceByUserId.get(member.user_id);
                        const status = presence?.status || 'offline';
                        const isYou = member.user_id === userId;

                        return (
                          <button
                            key={member.user_id}
                            onClick={() => {
                              if (isYou) return;
                              startPrivateCall({
                                id: member.user_id,
                                name: member.user_name,
                                roomId: currentChannel?.id || 'general',
                                workspaceId: (member as any).home_workspace_id || member.workspace_id || workspaceId,
                              });
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                              isYou
                                ? 'bg-[#0d0e12] border-[#303236] cursor-default'
                                : 'bg-[#0d0e12] border-[#303236] hover:border-indigo-500/50 hover:bg-[#1a1d21]'
                            }`}
                          >
                            <span className="text-xs text-white font-semibold truncate text-left">
                              {member.user_name}{isYou ? ' (You)' : ''}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#94a3b8]">
                              <span className={`w-2 h-2 rounded-full ${getStatusDotClass(status)}`} />
                              {getStatusLabel(status)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-3">Pinned</h4>
                    <div className="space-y-2">
                      {messages.filter((message) => pinnedMessageIds.includes(message.id)).slice(0, 4).map((msg) => (
                        <div key={msg.id} className="bg-[#0d0e12] border border-[#303236] rounded-lg px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[#64748b]">{msg.userName}</p>
                          <p className="text-xs text-[#cbd5e1] mt-1 line-clamp-2">{msg.text}</p>
                        </div>
                      ))}
                      {messages.filter((message) => pinnedMessageIds.includes(message.id)).length === 0 && (
                        <p className="text-xs text-[#64748b]">No pinned messages yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

        </div>

        {/* Unread Mentions Indicator (Bottom) */}
      </main>

      {/* Schedule Meeting Modal */}
      <AnimatePresence>
        {showCallLauncher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#222529] border border-[#303236] p-6 rounded-2xl w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Start Call</h2>
                <button onClick={() => setShowCallLauncher(false)} className="text-[#94a3b8] hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {[
                  { id: 'member', label: 'Call Member' },
                  { id: 'channel', label: 'Call Channel' },
                  { id: 'team', label: 'Call Team' },
                  { id: 'group', label: 'Call Multiple' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCallMode(item.id as 'member' | 'channel' | 'group' | 'team');
                      setSelectedCallMemberIds([]);
                      setSelectedTeamCallId('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      callMode === item.id ? 'bg-indigo-600 text-white' : 'bg-[#16171d] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {callMode !== 'channel' && callMode !== 'team' && (
                <div className="border border-[#303236] bg-[#0d0e12] rounded-lg p-3 max-h-56 overflow-y-auto custom-scrollbar space-y-2">
                  {panelMembers
                    .filter((member) => member.user_id !== userId)
                    .map((member) => {
                      const selected = selectedCallMemberIds.includes(member.user_id);
                      return (
                        <button
                          key={member.user_id}
                          onClick={() => {
                            if (callMode === 'member') {
                              setSelectedCallMemberIds([member.user_id]);
                              return;
                            }
                            setSelectedCallMemberIds((prev) =>
                              selected ? prev.filter((id) => id !== member.user_id) : [...prev, member.user_id]
                            );
                          }}
                          className={`w-full flex items-center justify-between px-2 py-2 rounded text-xs ${
                            selected ? 'bg-indigo-600/20 border border-indigo-500/30 text-white' : 'bg-[#16171d] text-[#cbd5e1] border border-[#26272e]'
                          }`}
                        >
                          <span>{member.user_name}</span>
                          {selected && <UserCheck size={14} />}
                        </button>
                      );
                    })}
                </div>
              )}

              {callMode === 'channel' && (
                <div className="border border-[#303236] bg-[#0d0e12] rounded-lg p-3 text-sm text-[#cbd5e1]">
                  Channel call starts in current context: #{currentChannel?.name || 'general'}
                </div>
              )}

              {callMode === 'team' && (
                <div className="border border-[#303236] bg-[#0d0e12] rounded-lg p-3 space-y-2">
                  <p className="text-xs text-[#94a3b8]">Select team to call</p>
                  <select
                    value={selectedTeamCallId}
                    onChange={(e) => setSelectedTeamCallId(e.target.value)}
                    className="w-full bg-[#16171d] border border-[#303236] text-white rounded-lg px-2.5 py-2 text-xs"
                  >
                    <option value="">Choose team</option>
                    {(workspace?.teams || []).map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setShowCallLauncher(false)} className="px-3 py-2 text-sm bg-[#303236] hover:bg-[#404246] text-white rounded-lg">Cancel</button>
                <button
                  onClick={launchCall}
                  disabled={(callMode === 'member' || callMode === 'group') ? selectedCallMemberIds.length === 0 : callMode === 'team' ? !selectedTeamCallId : false}
                  className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg"
                >
                  Start Call
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isMeetingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#222529] border border-[#303236] p-6 rounded-2xl w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Schedule Video Meeting</h2>
                <button onClick={() => setIsMeetingModalOpen(false)} className="text-[#94a3b8] hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {meetingError && (
                <div className="mb-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                  {meetingError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Meeting Title</label>
                  <input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Issue sync with backend"
                    className="w-full bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Date and Time</label>
                  <input
                    type="datetime-local"
                    value={meetingWhen}
                    onChange={(e) => setMeetingWhen(e.target.value)}
                    className="w-full bg-[#0d0e12] border border-[#303236] text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Invite Members</label>
                  <div className="max-h-36 overflow-y-auto custom-scrollbar border border-[#303236] rounded-lg p-2 bg-[#0d0e12] space-y-1">
                    {panelMembers.map((member) => (
                      <label key={member.user_id} className="flex items-center gap-2 text-xs text-[#cbd5e1]">
                        <input
                          type="checkbox"
                          checked={meetingParticipantIds.includes(member.user_id)}
                          onChange={(e) => {
                            setMeetingParticipantIds((prev) =>
                              e.target.checked ? [...prev, member.user_id] : prev.filter((id) => id !== member.user_id)
                            );
                          }}
                        />
                        {member.user_name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setIsMeetingModalOpen(false)} className="px-3 py-2 text-sm bg-[#303236] hover:bg-[#404246] text-white rounded-lg">Cancel</button>
                <button onClick={scheduleMeeting} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Schedule</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showCreateChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#222529] border border-[#303236] p-6 rounded-2xl w-full max-w-3xl shadow-2xl"
            >
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white">Create a Channel</h2>
                <p className="text-xs text-[#94a3b8] mt-1">Step {createChannelStep} of 3</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full ${createChannelStep >= step ? 'bg-indigo-500' : 'bg-[#303236]'}`}
                    />
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateChannel} className="space-y-4">
                {commError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
                    {commError}
                  </div>
                )}

                {createChannelStep === 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Channel Name</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        type="text"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder="e.g. platform-ops"
                        className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {createChannelStep === 2 && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Members</label>
                    <input
                      type="text"
                      value={newChannelMemberSearch}
                      onChange={(e) => setNewChannelMemberSearch(e.target.value)}
                      placeholder="Filter by name, email, or ID"
                      className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="max-h-72 overflow-y-auto custom-scrollbar border border-[#303236] rounded-xl bg-[#1a1d21] p-3">
                      {filteredNewChannelMembers.length === 0 && (
                        <p className="text-xs text-[#64748b] px-2 py-2">No members match this filter.</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {filteredNewChannelMembers.map((member) => {
                          const checked = newChannelMemberIds.includes(member.user_id);
                          const displayName = member.user_name || member.user_id;
                          return (
                            <button
                              key={member.user_id}
                              type="button"
                              onClick={() => toggleChannelWizardMember(member.user_id)}
                              className={`relative group rounded-xl border p-2 transition-all ${checked ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#303236] bg-[#111218] hover:bg-[#22252b]'}`}
                              aria-label={`Toggle member ${displayName}`}
                            >
                              <div className="mx-auto w-12 h-12 rounded-full border border-indigo-500/40 bg-indigo-600/25 text-white text-xs font-bold flex items-center justify-center">
                                {getInitials(displayName)}
                              </div>
                              <p className="mt-2 text-[11px] text-[#cbd5e1] truncate">{displayName}</p>
                              <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 w-52 bg-[#0a0b0f] border border-[#303236] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <p className="text-[11px] text-white truncate">{displayName}</p>
                                <p className="text-[10px] text-[#94a3b8] truncate">{member.user_id}</p>
                              </div>
                              <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${checked ? 'bg-indigo-400' : 'bg-[#475569]'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94a3b8]">{newChannelMemberIds.length} member(s) selected.</p>
                  </div>
                )}

                {createChannelStep === 3 && (
                  <div className="space-y-3 rounded-xl border border-[#303236] bg-[#1a1d21] p-4">
                    <p className="text-xs uppercase tracking-wide text-[#94a3b8]">Review</p>
                    <div className="text-sm text-white">
                      <span className="text-[#94a3b8]">Channel:</span> #{newChannelName.trim() || 'untitled-channel'}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-white">
                        <span className="text-[#94a3b8]">Visibility:</span> {newChannelVisibility === 'private' ? 'Private' : 'Public'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNewChannelVisibility('public')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            newChannelVisibility === 'public'
                              ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                              : 'bg-[#111218] border-[#303236] text-[#cbd5e1] hover:bg-[#22252b]'
                          }`}
                        >
                          Public
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewChannelVisibility('private')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            newChannelVisibility === 'private'
                              ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                              : 'bg-[#111218] border-[#303236] text-[#cbd5e1] hover:bg-[#22252b]'
                          }`}
                        >
                          Private
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-white">
                      <span className="text-[#94a3b8]">Members invited:</span> {newChannelMemberIds.length}
                    </div>
                    <p className="text-[11px] text-[#94a3b8]">Submit will create the channel and add selected members beneath Channels.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={closeCreateChannelWizard}
                    className="flex-1 bg-[#303236] hover:bg-[#404246] text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    Cancel
                  </button>

                  {createChannelStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCreateChannelStep((prev) => (prev === 1 ? 1 : (prev - 1) as 1 | 2 | 3))}
                      className="flex-1 bg-[#26272e] hover:bg-[#303236] text-white font-semibold py-2 rounded-xl transition-all"
                    >
                      Back
                    </button>
                  )}

                  {createChannelStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setCreateChannelStep((prev) => (prev + 1) as 1 | 2 | 3)}
                      disabled={createChannelStep === 1 && !newChannelName.trim()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-all"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!newChannelName.trim() || isCreatingCommChannel}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-all"
                    >
                      {isCreatingCommChannel ? 'Creating...' : 'Submit'}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface VideoCardProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  muted?: boolean;
  blurBackground?: boolean;
  backgroundImageUrl?: string | null;
  key?: string | number;
}

function VideoCard({ stream, name, isLocal, muted, blurBackground, backgroundImageUrl }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-[#16171d] rounded-2xl overflow-hidden border border-[#26272e] aspect-video group shadow-2xl transition-all hover:border-indigo-500/30">
      {backgroundImageUrl && (
        <div className="absolute inset-0">
          <img src={backgroundImageUrl} alt="background" className="w-full h-full object-cover opacity-60" />
        </div>
      )}
      {stream ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={muted}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''} ${blurBackground ? 'blur-sm scale-110' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#0d0e12]">
          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-indigo-500/20">
            {name[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 border border-white/10">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {name}
        {isLocal && <span className="text-[10px] opacity-60 font-medium">(You)</span>}
      </div>
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
        <div className="bg-black/60 backdrop-blur-xl p-2 rounded-xl border border-white/10">
          <Settings size={16} className="text-white cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

function ControlButton({ onClick, active = true, icon: Icon, label, className = "" }: any) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button 
        onClick={onClick}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all transform active:scale-90 ${
          active 
            ? 'bg-[#26272e] text-[#e2e8f0] hover:bg-[#303236] shadow-lg' 
            : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
        }`}
      >
        <Icon size={24} />
      </button>
      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ChatInput({
  onSend,
  onUploadFile,
  onVideoClick,
  onTerminateVideo,
  isVideoActive,
  onScheduleMeeting,
  onOpenIssue,
  onOpenDocs,
  onOpenIDE,
}: {
  onSend: (text?: string, fileData?: any) => void;
  onUploadFile: (file: File) => Promise<{ url: string; name: string; type: string }>;
  onVideoClick: () => void;
  onTerminateVideo: () => void;
  isVideoActive: boolean;
  onScheduleMeeting: () => void;
  onOpenIssue: () => void;
  onOpenDocs: () => void;
  onOpenIDE: () => void;
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commandPresets = ['/issue ', '/meet ', '/doc ', '/task ', '/status available'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
      setShowEmoji(false);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setText(prev => prev + emojiData.emoji);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await onUploadFile(file);
      onSend(undefined, uploaded);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {showSlashMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            className="absolute bottom-full right-0 mb-3 w-64 bg-[#16171d] border border-[#26272e] rounded-xl shadow-2xl z-50 p-2"
          >
            <p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b] px-2 py-1">Command Bar</p>
            {commandPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setText(preset);
                  setShowSlashMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-[#cbd5e1] hover:bg-[#26272e]"
              >
                {preset}
              </button>
            ))}
          </motion.div>
        )}
        {showEmoji && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-full left-0 mb-4 z-50"
          >
            <EmojiPicker 
              onEmojiClick={handleEmojiClick}
              theme={Theme.DARK}
              width={320}
              height={400}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button type="button" onClick={onOpenIssue} className="px-2 py-1 text-[11px] rounded-lg bg-[#16171d] border border-[#26272e] text-[#cbd5e1] hover:text-white">Create/Open Issue</button>
          <button type="button" onClick={onOpenDocs} className="px-2 py-1 text-[11px] rounded-lg bg-[#16171d] border border-[#26272e] text-[#cbd5e1] hover:text-white">Docs</button>
          <button type="button" onClick={onOpenIDE} className="px-2 py-1 text-[11px] rounded-lg bg-[#16171d] border border-[#26272e] text-[#cbd5e1] hover:text-white">IDE</button>
          <button type="button" onClick={onScheduleMeeting} className="px-2 py-1 text-[11px] rounded-lg bg-[#16171d] border border-[#26272e] text-[#cbd5e1] hover:text-white">Schedule Meeting</button>
          {isVideoActive && (
            <button type="button" onClick={onTerminateVideo} className="px-2 py-1 text-[11px] rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30">Terminate UPS</button>
          )}
        </div>
        <div className="bg-[#16171d] border border-[#26272e] rounded-2xl overflow-hidden focus-within:border-indigo-500 transition-all shadow-2xl">
          <div className="flex items-center gap-1 px-4 py-2 bg-[#0d0e12]/30 border-b border-[#26272e]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"
              title="Attach file"
            >
              <Plus size={18} />
            </button>
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Smile size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><AtSign size={18} /></button>
            <button type="button" onClick={() => setShowSlashMenu((prev) => !prev)} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" title="Slash commands">
              <ListTodo size={18} />
            </button>
            <button type="button" onClick={onVideoClick} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Video size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Mic size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><FileCode size={18} /></button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === '/' && text.length === 0) {
                setShowSlashMenu(true);
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message @issue or type / for commands"
            className="w-full bg-transparent text-[15px] text-white p-4 min-h-[120px] focus:outline-none resize-none placeholder-[#475569]"
          />
          <div className="flex items-center justify-end px-4 py-2 bg-[#0d0e12]/30">
            <button 
              type="submit"
              disabled={!text.trim() || isUploading}
              className="text-[#94a3b8] hover:text-indigo-400 disabled:opacity-30 p-2 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

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
  Database as DatabaseIcon,
  Info,
  AlertCircle,
  Smile,
  Paperclip,
  FileText,
  Image as ImageIcon,
  UserPlus,
  Users2,
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
  UserCheck,
  CornerUpLeft
} from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useWebRTC } from './hooks/useWebRTC';
import { ChatMessage, User, Workspace, Channel, Team } from './types';
import { NEW_GLOBAL_NAV, NAVIGATION_TREE } from './constants';
import { supabase } from './lib/supabase';
import {
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
  { icon: Headphones, label: 'Huddles', id: 'huddles' },
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
  const [showSchema, setShowSchema] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'private'>('public');
  const [selectedChannelMemberIds, setSelectedChannelMemberIds] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
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
  const [isCreatingCommChannel, setIsCreatingCommChannel] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);
  const [commError, setCommError] = useState<string | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [myStatus, setMyStatus] = useState<PresenceOptionValue>('available');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [isWorkspaceSidebarCollapsed, setIsWorkspaceSidebarCollapsed] = useState(false);
  const [isLeftDetailsOpen, setIsLeftDetailsOpen] = useState(false);
  const [dmSearchTerm, setDmSearchTerm] = useState('');
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
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmSearchTerm, setNewDmSearchTerm] = useState('');
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
          <aside className={`${isWorkspaceSidebarCollapsed ? 'w-12' : 'w-[240px]'} border-r border-[#1e2028] bg-[#0f1117] transition-all duration-200 flex-shrink-0 flex flex-col`}>
            <div className="h-12 px-3 flex items-center justify-between border-b border-[#1e2028] flex-shrink-0">
              {!isWorkspaceSidebarCollapsed && (
                <span className="text-[13px] font-semibold text-white truncate">
                  {workspaceChoices.find(w => w.id === supabaseWorkspaceId)?.name || workspaceId || 'Workspace'}
                </span>
              )}
              <button
                onClick={() => setIsWorkspaceSidebarCollapsed((prev) => !prev)}
                className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1e2028] rounded-lg transition-all flex-shrink-0"
              >
                <Menu size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {[
                { id: 'activity', icon: Bell, label: 'Activity', badge: unreadNotifications.length },
                { id: 'directory', icon: Users, label: 'Directory' },
                { id: 'files', icon: FileText, label: 'Files' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveSidebarItem(item.id)}
                  className={`w-full flex items-center gap-2.5 ${isWorkspaceSidebarCollapsed ? 'justify-center py-2' : 'px-2.5 py-1.5 justify-between'} rounded-lg text-[13px] font-medium transition-all ${
                    activeSidebarItem === item.id ? 'bg-[#1e2028] text-white' : 'text-[#64748b] hover:text-white hover:bg-[#15171f]'
                  }`}
                  title={isWorkspaceSidebarCollapsed ? item.label : undefined}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={15} />
                    {!isWorkspaceSidebarCollapsed && item.label}
                  </span>
                  {!isWorkspaceSidebarCollapsed && item.badge ? (
                    <span className="text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold px-1">
                      {(item.badge as number) > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </button>
              ))}

              {!isWorkspaceSidebarCollapsed && (
                <>
                  <div className="pt-2 pb-1">
                    <div className="flex items-center justify-between px-2 mb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#374151]">Channels</span>
                      <button
                        onClick={() => { setSelectedChannelMemberIds([]); setShowCreateChannel(true); }}
                        className="p-0.5 text-[#374151] hover:text-[#94a3b8] hover:bg-[#1e2028] rounded transition-all"
                        title="Create channel"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="space-y-0.5">
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
                            markConversationNotificationsRead(conversation.id);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                            commConversationId === conversation.id && activeSidebarItem === 'messages'
                              ? 'bg-[#1e2028] text-white'
                              : 'text-[#64748b] hover:text-[#cbd5e1] hover:bg-[#15171f]'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Hash size={13} className="flex-shrink-0 opacity-60" />
                            <span className="truncate">{conversation.name}</span>
                          </span>
                          {(unreadCountByConversation[conversation.id] || 0) > 0 && (
                            <span className="text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold px-1">
                              {unreadCountByConversation[conversation.id]}
                            </span>
                          )}
                        </button>
                      ))}
                      {channelConversations.length === 0 && (
                        <p className="text-[11px] text-[#374151] px-2 py-1">No channels yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 pb-1">
                    <div className="flex items-center justify-between px-2 mb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#374151]">Direct Messages</span>
                      <button
                        onClick={() => { setNewDmSearchTerm(''); setShowNewDmModal(true); }}
                        className="p-0.5 text-[#374151] hover:text-[#94a3b8] hover:bg-[#1e2028] rounded transition-all"
                        title="New direct message"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {filteredDirectConversations.map((conversation) => {
                        const memberInfo = panelMembers.find(m => m.user_name && conversation.name.includes(m.user_name) && m.user_id !== userId);
                        const memberStatus = memberInfo ? presenceByUserId.get(memberInfo.user_id)?.status || 'offline' : 'offline';
                        return (
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
                              markConversationNotificationsRead(conversation.id);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                              commConversationId === conversation.id && activeSidebarItem === 'messages'
                                ? 'bg-[#1e2028] text-white'
                                : 'text-[#64748b] hover:text-[#cbd5e1] hover:bg-[#15171f]'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <div className="relative flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-[#26272e] flex items-center justify-center text-[9px] font-bold text-[#cbd5e1]">
                                  {(conversation.name.replace(/^(DM: |@ )/, '') || '?')[0]?.toUpperCase()}
                                </div>
                                <span className={`absolute -bottom-px -right-px w-2 h-2 rounded-full border border-[#0f1117] ${getStatusDotClass(memberStatus)}`} />
                              </div>
                              <span className="truncate">{conversation.name.replace(/^(DM: |@ )/, '')}</span>
                            </span>
                            {(unreadCountByConversation[conversation.id] || 0) > 0 && (
                              <span className="text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold px-1">
                                {unreadCountByConversation[conversation.id]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {filteredDirectConversations.length === 0 && (
                        <p className="text-[11px] text-[#374151] px-2 py-1">No direct messages yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1e2028] mt-2">
                    <button
                      onClick={() => { setActiveSidebarItem('huddle'); setIsVideoActive(true); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#4b5563] hover:text-white hover:bg-[#15171f] transition-all"
                    >
                      <Headphones size={15} />
                      Start Huddle
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3">
              {activeSidebarItem === 'messages' && (
                <div className="space-y-0.5 max-w-3xl mx-auto pt-4">
                {commError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300 mb-4">
                    {commError}
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                    <div className="w-16 h-16 bg-[#1e2028] rounded-2xl flex items-center justify-center mb-5">
                      <MessageSquare size={28} className="text-[#64748b]" />
                    </div>
                    <h4 className="text-base font-semibold text-white mb-1">Welcome to #{currentChannel?.name}</h4>
                    <p className="text-[#64748b] text-sm">This is the beginning of the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const isSameUser = prevMsg && prevMsg.userId === msg.userId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 300000);
                    
                    return (
                      <div key={msg.id} className={`group relative flex gap-3 hover:bg-[#16171d]/50 px-3 py-0.5 rounded-lg transition-colors cursor-default ${isSameUser ? '' : 'mt-3'}`}>
                        {/* Hover action bar */}
                        <div className="absolute -top-3.5 right-3 opacity-0 group-hover:opacity-100 transition-all duration-100 flex items-center gap-0.5 bg-[#1a1d24] border border-[#26272e] rounded-lg shadow-xl px-1 py-0.5 z-10">
                          <button
                            className="p-1.5 text-[#64748b] hover:text-yellow-400 hover:bg-[#26272e] rounded transition-all"
                            title="Add reaction"
                          >
                            <Smile size={13} />
                          </button>
                          <button
                            className="p-1.5 text-[#64748b] hover:text-indigo-400 hover:bg-[#26272e] rounded transition-all"
                            title="Reply in thread"
                          >
                            <CornerUpLeft size={13} />
                          </button>
                          <button
                            onClick={() => togglePinMessage(msg.id)}
                            className={`p-1.5 hover:bg-[#26272e] rounded transition-all ${pinnedMessageIds.includes(msg.id) ? 'text-indigo-400' : 'text-[#64748b] hover:text-white'}`}
                            title={pinnedMessageIds.includes(msg.id) ? 'Unpin' : 'Pin message'}
                          >
                            <Pin size={13} />
                          </button>
                          <button
                            className="p-1.5 text-[#64748b] hover:text-white hover:bg-[#26272e] rounded transition-all"
                            title="More actions"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        </div>

                        {!isSameUser ? (
                          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold text-[13px] mt-0.5">
                            {(msg.userName || '?')[0]?.toUpperCase() || '?'}
                          </div>
                        ) : (
                          <div className="w-8 flex-shrink-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-[#3d4555]">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pb-0.5">
                          {!isSameUser && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="font-semibold text-white text-[14px]">{msg.userName}</span>
                              <span className="text-[11px] text-[#3d4555]">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          <p className="text-[14px] text-[#b9c3d4] leading-relaxed break-words">{msg.text}</p>
                          
                          {msg.file_url && (
                            <div className="mt-2 flex items-center gap-3 p-3 bg-[#16171d] border border-[#1e2028] rounded-xl max-w-sm hover:border-indigo-500/40 transition-all group/file">
                              <div className="w-9 h-9 bg-indigo-600/15 rounded-lg flex items-center justify-center text-indigo-400 flex-shrink-0">
                                {msg.file_type?.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-white truncate">{msg.file_name}</p>
                                <p className="text-[10px] text-[#4b5563] uppercase tracking-wide">{msg.file_type?.split('/')[1] || 'FILE'}</p>
                              </div>
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#4b5563] hover:text-white transition-colors flex-shrink-0">
                                <ExternalLink size={15} />
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
                            <span className="text-white truncate">{member.user_name}</span>
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
                <h4 className="text-xl font-bold text-white mb-2">Standup Huddle</h4>
                <p className="text-[#94a3b8] font-medium mb-6">
                  Real-time video uses WebRTC with STUN servers and can be launched from the top bar or chat composer video icon.
                </p>
                <button
                  onClick={() => setIsVideoActive(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  Start Huddle
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
              <div className="px-3 py-3 bg-[#0d0e12] border-t border-[#1e2028]">
                <div className="max-w-3xl mx-auto">
                  <ChatInput
                    onSend={handleSendMessage}
                    onVideoClick={handleComposerVideoClick}
                    onTerminateVideo={terminateHuddle}
                    isVideoActive={isVideoActive}
                    onScheduleMeeting={() => setIsMeetingModalOpen(true)}
                    onOpenIssue={() => goToCoreView('issues', 'assigned-to-me')}
                    onOpenDocs={() => goToCoreView('chat', 'files')}
                    onOpenIDE={() => goToCoreView('code-prs', 'pull-requests')}
                    onUploadFile={handleUploadFile}
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
                    className="bg-[#0d0e12] border border-[#1e2028] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                          <div className="w-9 h-9 bg-[#26272e] rounded-lg flex items-center justify-center text-white font-bold text-xs">
                            {(member.user_name || '?')[0]?.toUpperCase()}
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
                <div className="px-3 py-1.5 bg-[#0d0e12] border border-[#1e2028] rounded-lg text-xs font-semibold text-[#cbd5e1] uppercase tracking-wide">
                  Role: {currentRole}
                </div>
              </div>

              {roleUpdateError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
                  {roleUpdateError}
                </div>
              )}

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

                    return (
                      <div key={member.user_id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-[#26272e] rounded-lg flex items-center justify-center text-white font-bold text-xs">
                            {(member.user_name || '?')[0]?.toUpperCase()}
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
                            <select
                              value={member.role}
                              onChange={(e) => updateMemberRole(member.user_id, e.target.value as 'owner' | 'admin' | 'employee')}
                              className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-lg px-2 py-1.5 text-xs"
                            >
                              <option value="employee">Employee</option>
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </select>
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
                  <div className="p-4 border-b border-[#26272e] flex items-center justify-between bg-[#0d0e12]/50">
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

  const createCommChannelWithName = async (channelName: string, isPrivate = false) => {
    if (!supabase || !supabaseWorkspaceId || !userId) {
      setCommError('Select a workspace and sign in before creating a channel.');
      return null;
    }

    const cleanedName = channelName.trim();
    if (!cleanedName) {
      setCommError('Channel name is required.');
      return null;
    }

    const requestedSlug = cleanedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data, error } = await supabase.rpc('comm_create_channel', {
      p_workspace_id: supabaseWorkspaceId,
      p_name: cleanedName,
      p_topic: '',
      p_is_private: isPrivate,
      p_slug: requestedSlug || null,
    });

    const conversation = Array.isArray(data) ? data[0] : null;
    if (error || !conversation) {
      console.error('Error creating channel:', error);
      setCommError(error?.message || 'Unable to create channel.');
      return null;
    }

    return {
      id: conversation.id,
      name: conversation.name,
      workspace_id: conversation.workspace_id,
    } as { id: string; name: string; workspace_id: string | null };
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

  const addMembersToConversation = async (conversationId: string, memberIds: string[]) => {
    if (!supabase || !supabaseWorkspaceId || !conversationId || memberIds.length === 0) return;

    const uniqueMembers = Array.from(new Set(memberIds.filter((id) => id && id !== userId)));
    for (const targetUserId of uniqueMembers) {
      const member = panelMembers.find((item) => item.user_id === targetUserId);
      const targetWorkspaceId = (member as any)?.home_workspace_id || member?.workspace_id || supabaseWorkspaceId;

      const { error } = await supabase
        .from('comm_conversation_members')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: targetUserId,
            workspace_id: targetWorkspaceId,
            role: 'member',
          },
          { onConflict: 'conversation_id,user_id' }
        );

      if (error) {
        console.error('Error adding selected member:', error);
        continue;
      }

      await supabase.rpc('comm_notify_user', {
        p_workspace_id: targetWorkspaceId,
        p_user_id: targetUserId,
        p_kind: 'added_to_channel',
        p_payload: {
          conversation_id: conversationId,
          conversation_name: currentChannel?.name || 'channel',
          added_at: new Date().toISOString(),
        },
      });
    }
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
    if (!supabase || !userId) return null;

    const { data, error } = await supabase.rpc('comm_ensure_default_channel', {
      p_workspace_id: workspaceUuid,
      p_slug: 'general',
      p_name: 'general',
    });

    const conversation = Array.isArray(data) ? data[0] : null;
    if (error || !conversation) {
      console.error('Error ensuring default conversation:', error);
      return null;
    }

    setCommConversationId(conversation.id);
    setCurrentChannel({
      id: conversation.id,
      workspace_id: conversation.workspace_id || workspaceUuid,
      name: conversation.name || 'general',
    });

    return conversation.id as string;
  };

  const loadSupabaseCommunicationContext = async () => {
    if (!supabase || !userId) return null;

    const { data: bootstrapRows, error: bootstrapErr } = await supabase.rpc('comm_bootstrap_workspace_context', {
      p_preferred_slug: workspaceId,
    });

    if (bootstrapErr) {
      console.error('Error bootstrapping workspace context:', bootstrapErr);
      setCommError('Unable to initialize communication workspace context.');
      return null;
    }

    const rows = (bootstrapRows || []) as Array<{ id: string; name: string; slug: string; is_default: boolean }>;
    if (!rows.length) {
      setCommError('No workspace memberships found for this account.');
      return null;
    }

    const mappedChoices = rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
    setWorkspaceChoices(mappedChoices);

    const preferred = rows.find((row) => row.slug === workspaceId);
    const chosen = preferred || rows.find((row) => row.is_default) || rows[0];

    setCommError(null);
    setSupabaseWorkspaceId(chosen.id);
    if (chosen.slug) {
      setWorkspaceId(chosen.slug);
    }

    return chosen.id;
  };

  // Mark all unread notifications for a conversation as read (updates local state + DB)
  const markConversationNotificationsRead = (conversationId: string) => {
    if (!supabase || !userId || !supabaseWorkspaceId) return;
    supabase
      .from('comm_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('workspace_id', supabaseWorkspaceId)
      .is('read_at', null)
      .filter('payload->>conversation_id', 'eq', conversationId)
      .then(({ error }) => {
        if (!error) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.payload?.conversation_id === conversationId && !n.read_at
                ? { ...n, read_at: new Date().toISOString() }
                : n
            )
          );
        }
      });
  };

  // Upload a file to the comm-uploads Supabase Storage bucket.
  // Falls back to /api/upload when supabase is not configured.
  const handleUploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    if (!supabase) {
      // Local Express fallback for non-Supabase dev setups
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) return await res.json();
      } catch (err) {
        console.error('Local upload failed:', err);
      }
      return null;
    }

    const workspaceScope = supabaseWorkspaceId || 'general';
    const convScope = commConversationId || 'shared';
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    const path = `${workspaceScope}/${convScope}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('comm-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      setCommError(`File upload failed: ${uploadError.message}`);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from('comm-uploads').getPublicUrl(path);
    return { url: publicUrl, name: file.name, type: file.type };
  };


  // Fetch workspace and channels
  useEffect(() => {
    if (isJoined) {
      fetchWorkspace();
    }
  }, [isJoined, workspaceId]);

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

  // Real-time notification bell: instant unread badge updates without polling
  useEffect(() => {
    if (!supabase || !userId) return;

    const notifChannel = supabase
      .channel(`comm-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comm_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as ReachNotification;
          setNotifications((prev) => [incoming, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [userId, supabase]);

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

  const fetchWorkspace = () => {
    fetch(`/api/workspaces/${workspaceId}`)
      .then(res => res.json())
      .then(data => {
        setWorkspace(data);
        if (!currentChannel && data.channels.length > 0) {
          setCurrentChannel(data.channels[0]);
        }
      })
      .catch(err => console.error("Error fetching workspace:", err));
  };

  useEffect(() => {
    if (!isJoined || !workspaceId || !userId || !userName) return;

    fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, role: 'member' }),
    }).catch((err) => console.error('Error syncing workspace member:', err));
  }, [isJoined, workspaceId, userId, userName]);

  useEffect(() => {
    if (supabaseWorkspaceId) return;
    if (!isJoined || !workspaceId) return;

    const fetchPresence = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/presence`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.presence)) {
          setWorkspacePresence(data.presence);
        }
      } catch (err) {
        console.error('Error fetching workspace presence:', err);
      }
    };

    fetchPresence();
    const timer = setInterval(fetchPresence, 10000);
    return () => clearInterval(timer);
  }, [isJoined, workspaceId]);

  // Fetch message history when channel changes
  useEffect(() => {
    if (!commConversationId && currentChannel) {
      fetch(`/api/channels/${currentChannel.id}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error("Error fetching messages:", err));
    }
  }, [currentChannel, commConversationId]);

  useEffect(() => {
    const shouldUseLocalSocket = !supabase && (!commConversationId || isVideoActive);
    if (isJoined && currentChannel && shouldUseLocalSocket) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join',
          payload: { workspaceId, roomId: currentChannel.id, userId, userName }
        }));
      };

      ws.onmessage = (event) => {
        const { type, payload } = JSON.parse(event.data);
        if (type === 'chat' && !commConversationId) {
          setMessages((prev) => [...prev, payload]);
        }
      };

      setSocket(ws);
      return () => ws.close();
    }
  }, [isJoined, currentChannel, userId, userName, workspaceId, commConversationId, isVideoActive]);

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
    : [{ workspace_id: workspaceId, user_id: userId, user_name: userName || 'You', role: 'member' }];
  const onlineMembers = panelMembers.filter((member) => {
    const status = presenceByUserId.get(member.user_id)?.status || 'offline';
    return status === 'online' || status === 'available' || status === 'out_of_office';
  });
  const currentMemberRole = panelMembers.find((member) => member.user_id === userId)?.role || 'employee';
  const isAdminUser = currentMemberRole === 'owner' || currentMemberRole === 'admin';
  const channelConversations = commConversations.filter((conversation) => conversation.kind === 'channel');
  const directConversations = commConversations.filter((conversation) => conversation.kind !== 'channel');
  const filteredDirectConversations = directConversations.filter((conversation) => {
    if (!dmSearchTerm.trim()) return true;
    return conversation.name.toLowerCase().includes(dmSearchTerm.trim().toLowerCase());
  });
  const filteredNewDmCandidates = panelMembers
    .filter((member) => member.user_id !== userId)
    .filter((member) => {
      if (!newDmSearchTerm.trim()) return true;
      return member.user_name.toLowerCase().includes(newDmSearchTerm.trim().toLowerCase());
    });
  const unreadNotifications = notifications.filter((item) => !item.read_at);

  const unreadCountByConversation = unreadNotifications.reduce<Record<string, number>>((acc, item) => {
    const conversationId = item.payload?.conversation_id;
    if (typeof conversationId === 'string' && conversationId) {
      acc[conversationId] = (acc[conversationId] || 0) + 1;
    }
    return acc;
  }, {});

  const handleSendMessage = async (text?: string, fileData?: any) => {
    if (text?.trim() || fileData) {
      if (supabase) {
        let resolvedWorkspaceId = supabaseWorkspaceId;
        if (!resolvedWorkspaceId) {
          resolvedWorkspaceId = await loadSupabaseCommunicationContext();
        }

        if (!resolvedWorkspaceId) {
          setCommError('Communication workspace is not initialized. Please re-open this workspace context.');
          return;
        }

        setCommError(null);
        let targetConversationId = commConversationId;
        if (!targetConversationId) {
          targetConversationId = await ensureCommConversation(resolvedWorkspaceId);
        }

        if (!targetConversationId) {
          setCommError('Unable to resolve an active conversation.');
          return;
        }

        const attachments = fileData ? [{
          url: fileData.url,
          name: fileData.name,
          type: fileData.type,
        }] : [];

        const input = text?.trim() || '';
        const body = input || (fileData?.name ? `Shared file: ${fileData.name}` : 'Shared attachment');

        const sender = input.startsWith('/')
          ? routeCommunicationCommand({
              workspaceId: resolvedWorkspaceId,
              conversationId: targetConversationId,
              input,
            })
          : sendCommunicationMessage({
              conversationId: targetConversationId,
              body,
              attachments,
            });

        sender
          .then(() => loadCommMessages(targetConversationId))
          .catch((err) => {
            console.error('Error sending communication message:', err);
            setCommError(err?.message || 'Failed to send communication message.');
          });
        return;
      }
    }

    if (!supabase && socket && (text?.trim() || fileData)) {
      socket.send(JSON.stringify({
        type: 'chat',
        payload: { 
          text,
          file_url: fileData?.url,
          file_name: fileData?.name,
          file_type: fileData?.type
        }
      }));
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    if (supabase && supabaseWorkspaceId && userId) {
      setIsCreatingCommChannel(true);
      setCommError(null);
      try {
        const conversation = await createCommChannelWithName(newChannelName, newChannelVisibility === 'private');
        if (!conversation) return;

        if (selectedChannelMemberIds.length > 0) {
          await addMembersToConversation(conversation.id, selectedChannelMemberIds);
        }

        setShowCreateChannel(false);
        setNewChannelName('');
        setNewChannelVisibility('public');
        setSelectedChannelMemberIds([]);
        setSelectedTeamId(null);
        setCommConversationId(conversation.id);
        setCurrentChannel({
          id: conversation.id,
          workspace_id: conversation.workspace_id || supabaseWorkspaceId || workspaceId,
          name: conversation.name,
        });
        await loadCommConversations(supabaseWorkspaceId);
        await loadCommMessages(conversation.id);
      } finally {
        setIsCreatingCommChannel(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: newChannelName, teamId: selectedTeamId })
      });
      const data = await res.json();
      if (res.ok) {
        setNewChannelName('');
        setNewChannelVisibility('public');
        setSelectedChannelMemberIds([]);
        setShowCreateChannel(false);
        setSelectedTeamId(null);
        fetchWorkspace();
        setCurrentChannel(data);
      }
    } catch (err) {
      console.error("Error creating channel:", err);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: newTeamName })
      });
      if (res.ok) {
        setNewTeamName('');
        setShowCreateTeam(false);
        fetchWorkspace();
      }
    } catch (err) {
      console.error("Error creating team:", err);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await fetch('/api/debug/schema');
      const data = await res.json();
      setSchemaData(data);
      setShowSchema(true);
    } catch (err) {
      console.error("Error fetching schema:", err);
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
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        handleSendMessage(`Shared during huddle: ${file.name}`, data);
      }
    } catch (error) {
      console.error('Failed to upload huddle asset:', error);
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

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111318] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-[#1e2028]"
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
                    className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
                  className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
                className="w-full bg-[#0d0e12] border border-[#1e2028] hover:border-indigo-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
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
          <div className="mt-6 pt-6 border-t border-[#1e2028] flex justify-center">
            <button 
              onClick={fetchSchema}
              className="text-xs text-gray-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <DatabaseIcon size={12} />
              View Database Schema
            </button>
          </div>
        </motion.div>

        {/* Schema Modal */}
        <AnimatePresence>
          {showSchema && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#111318] border border-[#1e2028] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-4 border-b border-[#1e2028] flex items-center justify-between bg-[#0d0e12]">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <DatabaseIcon size={18} className="text-indigo-400" />
                    SQLite Database Schema
                  </h2>
                  <button onClick={() => setShowSchema(false)} className="text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {schemaData && Object.entries(schemaData).map(([tableName, columns]: [string, any]) => (
                    <div key={tableName} className="space-y-3">
                      <h3 className="text-indigo-400 font-mono font-bold text-lg border-b border-indigo-500/20 pb-1">
                        TABLE {tableName}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono text-gray-500 uppercase tracking-wider px-2">
                        <span>Column</span>
                        <span>Type</span>
                        <span>PK</span>
                      </div>
                      <div className="space-y-1">
                        {columns.map((col: any) => (
                          <div key={col.name} className="grid grid-cols-3 gap-2 text-sm font-mono bg-[#0d0e12] p-2 rounded border border-[#1e2028]">
                            <span className="text-white">{col.name}</span>
                            <span className="text-gray-400">{col.type}</span>
                            <span className="text-indigo-500">{col.pk ? 'YES' : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0e12] flex overflow-hidden font-sans text-[#e2e8f0]">
      {/* Global Navigation Sidebar (Far Left) */}
      <nav className="w-[60px] bg-[#0a0b0f] border-r border-[#1e2028] flex flex-col items-center py-3 flex-shrink-0 z-30">
        <button
          onClick={() => {
            setActiveGlobalNav('issues');
            setActiveSidebarItem('assigned-to-me');
          }}
          className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mb-5 text-white hover:bg-indigo-500 transition-all"
          aria-label="Go to Home"
          title="Home"
        >
          <span className="text-[11px] font-black tracking-tighter">R</span>
        </button>
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar w-full items-center">
          {NEW_GLOBAL_NAV.map((item) => (
            <div key={item.id} className="relative group/nav w-full flex justify-center">
              <button 
                onClick={() => {
                  setActiveGlobalNav(item.id);
                  const firstChild = (NAVIGATION_TREE as any)[item.id]?.[0];
                  if (firstChild) {
                    setActiveSidebarItem(firstChild.id);
                  }
                }}
                className={`p-2 rounded-xl transition-all w-9 h-9 flex items-center justify-center ${
                  activeGlobalNav === item.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-[#4b5563] hover:text-white hover:bg-[#1a1c24]'
                }`}
                title={item.label}
              >
                <item.icon size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1 items-center">
          <button className="p-2 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-xl transition-all w-9 h-9 flex items-center justify-center" title="Create new">
            <Plus size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-[#0d0e12]">
        {/* Top Header Bar */}
        <header className="h-[52px] border-b border-[#1e2028] flex items-center justify-between px-5 bg-[#0a0b0f] z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-[13px] tracking-wide">
                {NEW_GLOBAL_NAV.find(n => n.id === activeGlobalNav)?.label || activeGlobalNav}
              </span>
              {workspaceChoices.length > 0 && (
                <select
                  value={supabaseWorkspaceId || ''}
                  onChange={(e) => setSupabaseWorkspaceId(e.target.value || null)}
                  className="bg-[#0f1117] border border-[#1e2028] text-[#94a3b8] rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Switch workspace"
                >
                  {workspaceChoices.map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div ref={statusMenuRef} className="relative">
              <button
                onClick={() => setShowStatusMenu((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-[#0f1117] border border-[#1e2028] rounded-lg text-[#64748b] hover:text-white transition-all"
              >
                <span className={`w-2 h-2 rounded-full ${getStatusDotClass(myStatus)}`} />
                <span className="text-[12px] font-medium">{onlineCount} online</span>
                <ChevronDown size={12} className={`transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
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

            <div className="flex items-center gap-0.5 bg-[#0f1117] border border-[#1e2028] rounded-lg px-1 py-0.5">
              <button onClick={() => goToCoreView('issues', 'following')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Favorites">
                <Star size={15} />
              </button>
              <button onClick={() => goToCoreView('code-prs', 'pull-requests')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Code & PRs">
                <Code2 size={15} />
              </button>
              <button onClick={() => goToCoreView('time-tracker', 'active-timer')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Time tracker">
                <Clock size={15} />
              </button>
              <button onClick={() => goToCoreView('chat', 'files')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Docs">
                <FileText size={15} />
              </button>
              <button onClick={() => goToCoreView('chat', 'messages')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Chat">
                <MessageSquare size={15} />
              </button>
              <button onClick={() => goToCoreView('members', 'all-members')} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all" title="Settings">
                <Settings size={15} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={toggleStandup}
                className={`p-2 rounded-lg transition-all ${isVideoActive ? 'bg-indigo-600 text-white' : 'text-[#4b5563] hover:text-white hover:bg-[#1a1c24]'}`}
                title="Huddle"
              >
                <Headphones size={17} />
              </button>
              <button
                onClick={handleHeaderVideoClick}
                className={`p-2 rounded-lg transition-all ${isVideoActive && videoEnabled ? 'bg-indigo-600 text-white' : 'text-[#4b5563] hover:text-white hover:bg-[#1a1c24]'}`}
                title="Video"
              >
                <Video size={17} />
              </button>
              {isVideoActive && (
                <button
                  onClick={terminateHuddle}
                  className="px-2.5 py-1.5 bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 rounded-lg text-[11px] font-semibold transition-all"
                  title="End huddle"
                >
                  End
                </button>
              )}
            </div>
            <div className="h-5 w-px bg-[#1e2028]" />
            <div className="flex items-center bg-[#0f1117] border border-[#1e2028] rounded-lg px-2.5 py-1.5 gap-2">
              <Search size={13} className="text-[#4b5563]" />
              <input type="text" placeholder="Search…" className="bg-transparent border-none text-[12px] text-white focus:outline-none w-36 placeholder-[#3d4555]" />
            </div>
          </div>
        </header>

        {/* Page-Level Navigation Row */}
        {activeGlobalNav === 'chat' ? (
          <div className="border-b border-[#1e2028] h-11 px-4 flex items-center justify-between bg-[#0d0e12] flex-shrink-0 relative">
            <div className="flex items-center gap-2.5">
              {currentChannel?.name ? (
                <div className="flex items-center gap-1.5">
                  {directConversations.some(c => c.id === commConversationId) ? (
                    <AtSign size={14} className="text-[#4b5563]" />
                  ) : (
                    <Hash size={14} className="text-[#4b5563]" />
                  )}
                  <span className="text-[14px] font-semibold text-white">
                    {currentChannel.name.replace(/^(DM: |@ )/, '')}
                  </span>
                </div>
              ) : (
                <span className="text-[13px] text-[#4b5563]">Select a channel or DM</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setActiveSidebarItem('activity')}
                className={`p-1.5 rounded-lg transition-all relative ${activeSidebarItem === 'activity' ? 'text-white bg-[#1e2028]' : 'text-[#4b5563] hover:text-white hover:bg-[#1a1c24]'}`}
                title="Activity"
              >
                <Bell size={15} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
              <button
                onClick={() => setActiveSidebarItem('pins')}
                className={`p-1.5 rounded-lg transition-all ${activeSidebarItem === 'pins' ? 'text-white bg-[#1e2028]' : 'text-[#4b5563] hover:text-white hover:bg-[#1a1c24]'}`}
                title="Pinned messages"
              >
                <Pin size={15} />
              </button>
              <div className="w-px h-4 bg-[#1e2028] mx-1" />
              <button
                onClick={() => { setSelectedChannelMemberIds([]); setShowCreateChannel(true); }}
                className="flex items-center gap-1 px-2 py-1.5 text-[12px] font-semibold text-[#4b5563] hover:text-indigo-400 hover:bg-[#1a1c24] rounded-lg transition-all"
                title="Create channel"
              >
                <Hash size={13} />
                <Plus size={11} />
              </button>
              <button
                onClick={() => setShowCallLauncher(true)}
                className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all"
                title="Start call / huddle"
              >
                <Video size={15} />
              </button>
              <div className="w-px h-4 bg-[#1e2028] mx-1" />
              <div className="relative">
                <input
                  value={userSearchTerm}
                  onChange={(e) => searchUsersByName(e.target.value)}
                  placeholder="Find teammate…"
                  className="bg-[#16171d] border border-[#1e2028] text-white rounded-lg pl-7 pr-2 py-1.5 text-[12px] w-36 focus:outline-none focus:border-indigo-500 transition-all"
                />
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
                {userSearchTerm.trim() && (
                  <div className="absolute top-full right-0 mt-1 w-72 bg-[#16171d] border border-[#26272e] rounded-xl shadow-2xl z-50 p-1.5 space-y-0.5">
                    {isSearchingUsers && <p className="text-[11px] text-[#64748b] px-2 py-1.5">Searching…</p>}
                    {!isSearchingUsers && userSearchResults.slice(0, 6).map((result) => (
                      <div key={result.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1c24]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">
                            {(result.display_name || result.email || '?')[0]?.toUpperCase()}
                          </div>
                          <span className="text-[13px] text-white truncate">{result.display_name || result.email || result.user_id}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => { startPrivateCall({ id: result.user_id, name: result.display_name || 'User', roomId: currentChannel?.id || 'general', workspaceId: result.default_workspace_id || workspaceId }); setUserSearchTerm(''); setUserSearchResults([]); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2 py-0.5 text-[11px] font-semibold">DM</button>
                          {commConversationId && <button onClick={() => { addUserToCurrentConversation(result.user_id, result.default_workspace_id); setUserSearchTerm(''); setUserSearchResults([]); }} className="bg-[#26272e] hover:bg-[#303236] text-white rounded-lg px-2 py-0.5 text-[11px] font-semibold">Add</button>}
                        </div>
                      </div>
                    ))}
                    {!isSearchingUsers && userSearchResults.length === 0 && userSearchTerm.trim() && (
                      <p className="text-[11px] text-[#64748b] px-2 py-1.5">No users found.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[40px] border-b border-[#1e2028] flex items-center px-5 bg-[#0a0b0f] flex-shrink-0">
            <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar w-full">
              {topBarTabs.map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSidebarItem(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium tracking-wide transition-all whitespace-nowrap ${
                    activeSidebarItem === tab.id
                      ? 'bg-[#1e2028] text-white'
                      : 'text-[#64748b] hover:text-white hover:bg-[#1a1c24]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#1a1c24] rounded-lg transition-all flex-shrink-0 ml-1">
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Content Surface */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Floating Huddle Widget */}
            <AnimatePresence>
              {isVideoActive && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="fixed bottom-6 right-6 w-[340px] bg-[#111318] border border-[#26272e] rounded-2xl shadow-2xl z-40 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2028]">
                    <span className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Huddle
                    </span>
                    <div className="flex items-center gap-1">
                      <label className="p-1.5 rounded-lg border border-[#1e2028] text-[#64748b] hover:text-white hover:bg-[#1a1c24] cursor-pointer transition-all" title="Share file">
                        <Paperclip size={13} />
                        <input type="file" className="hidden" onChange={handleHuddleFileInput} />
                      </label>
                      <button
                        onClick={() => setIsVideoSettingsOpen((prev) => !prev)}
                        className="p-1.5 rounded-lg border border-[#1e2028] text-[#64748b] hover:text-white hover:bg-[#1a1c24] transition-all"
                        title="Settings"
                      >
                        <Settings size={13} />
                      </button>
                      <button
                        onClick={() => setShowCallLauncher(true)}
                        className="p-1.5 rounded-lg border border-[#1e2028] text-[#64748b] hover:text-white hover:bg-[#1a1c24] transition-all"
                        title="Add participant"
                      >
                        <UserPlus size={13} />
                      </button>
                    </div>
                  </div>

                  {isVideoSettingsOpen && (
                    <div className="px-3 py-2 border-b border-[#1e2028] bg-[#0d0e12] flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-[#94a3b8]">
                        <input type="checkbox" checked={isBackgroundBlurEnabled} onChange={(e) => setIsBackgroundBlurEnabled(e.target.checked)} />
                        Blur background
                      </label>
                      <label className="text-[11px] text-[#94a3b8] px-2 py-0.5 rounded border border-[#26272e] cursor-pointer hover:bg-[#1a1c24]">
                        Upload background
                        <input type="file" accept="image/*" className="hidden" onChange={handleVideoBackgroundUpload} />
                      </label>
                    </div>
                  )}

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsHuddleDragging(true); }}
                    onDragLeave={() => setIsHuddleDragging(false)}
                    onDrop={async (e) => { e.preventDefault(); setIsHuddleDragging(false); const file = e.dataTransfer.files?.[0]; if (file) await uploadHuddleAsset(file); }}
                    className={`flex gap-2 p-2 overflow-x-auto custom-scrollbar ${isHuddleDragging ? 'bg-indigo-500/5 border-indigo-400/30' : ''}`}
                  >
                    {screenShareStream && (
                      <div className="w-36 flex-shrink-0">
                        <VideoCard stream={screenShareStream} name="Shared Screen" />
                      </div>
                    )}
                    <div className="w-36 flex-shrink-0">
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
                        <div key={id} className="w-36 flex-shrink-0">
                          <VideoCard stream={stream} name={participant?.name || 'User'} />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-[#1e2028]">
                    <button
                      onClick={toggleAudio}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${audioEnabled ? 'bg-[#1e2028] text-[#cbd5e1] hover:bg-[#26272e]' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                      title={audioEnabled ? 'Mute' : 'Unmute'}
                    >
                      {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                    </button>
                    <button
                      onClick={toggleVideo}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${videoEnabled ? 'bg-[#1e2028] text-[#cbd5e1] hover:bg-[#26272e]' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                      title={videoEnabled ? 'Stop video' : 'Start video'}
                    >
                      {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                    </button>
                    <button
                      onClick={toggleScreenShare}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${!screenShareStream ? 'bg-[#1e2028] text-[#cbd5e1] hover:bg-[#26272e]' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'}`}
                      title={screenShareStream ? 'Stop sharing' : 'Share screen'}
                    >
                      <Monitor size={16} />
                    </button>
                    <button 
                      onClick={terminateHuddle}
                      className="ml-auto px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5"
                    >
                      <LogOut size={13} />
                      Leave
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
              className="bg-[#111318] border border-[#1e2028] p-6 rounded-2xl w-full max-w-lg shadow-2xl"
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
                <div className="border border-[#1e2028] bg-[#0d0e12] rounded-lg p-3 max-h-56 overflow-y-auto custom-scrollbar space-y-2">
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
                <div className="border border-[#1e2028] bg-[#0d0e12] rounded-lg p-3 text-sm text-[#cbd5e1]">
                  Channel call starts in current context: #{currentChannel?.name || 'general'}
                </div>
              )}

              {callMode === 'team' && (
                <div className="border border-[#1e2028] bg-[#0d0e12] rounded-lg p-3 space-y-2">
                  <p className="text-xs text-[#94a3b8]">Select team to call</p>
                  <select
                    value={selectedTeamCallId}
                    onChange={(e) => setSelectedTeamCallId(e.target.value)}
                    className="w-full bg-[#16171d] border border-[#1e2028] text-white rounded-lg px-2.5 py-2 text-xs"
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

        {showNewDmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111318] border border-[#1e2028] p-6 rounded-2xl w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">New Direct Message</h2>
                <button
                  onClick={() => {
                    setShowNewDmModal(false);
                    setNewDmSearchTerm('');
                  }}
                  className="text-[#94a3b8] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <input
                value={newDmSearchTerm}
                onChange={(e) => setNewDmSearchTerm(e.target.value)}
                placeholder="Select a user to message"
                className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-lg px-3 py-2 text-sm mb-3"
              />

              <div className="max-h-72 overflow-y-auto custom-scrollbar border border-[#1e2028] bg-[#0d0e12] rounded-lg p-2 space-y-1">
                {filteredNewDmCandidates.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() => {
                      startPrivateCall({
                        id: member.user_id,
                        name: member.user_name,
                        roomId: currentChannel?.id || 'general',
                        workspaceId: (member as any).home_workspace_id || member.workspace_id || workspaceId,
                      });
                      setShowNewDmModal(false);
                      setNewDmSearchTerm('');
                      setActiveSidebarItem('messages');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded border border-[#26272e] bg-[#16171d] hover:bg-[#26272e] text-left"
                  >
                    <span className="text-sm text-white truncate">{member.user_name}</span>
                    <span className="text-[11px] text-[#94a3b8] uppercase">{member.role}</span>
                  </button>
                ))}
                {filteredNewDmCandidates.length === 0 && (
                  <p className="text-xs text-[#64748b] px-2 py-1">No users found.</p>
                )}
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
              className="bg-[#111318] border border-[#1e2028] p-6 rounded-2xl w-full max-w-lg shadow-2xl"
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
                    className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Date and Time</label>
                  <input
                    type="datetime-local"
                    value={meetingWhen}
                    onChange={(e) => setMeetingWhen(e.target.value)}
                    className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Invite Members</label>
                  <div className="max-h-36 overflow-y-auto custom-scrollbar border border-[#1e2028] rounded-lg p-2 bg-[#0d0e12] space-y-1">
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
              className="bg-[#111318] border border-[#1e2028] p-6 rounded-2xl w-full max-w-lg shadow-2xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">Create a Channel</h2>
              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Channel Name</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input 
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. project-x"
                      className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Visibility</label>
                  <div className="space-y-2 rounded-xl border border-[#1e2028] p-3 bg-[#0d0e12]">
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input
                        type="radio"
                        name="channel-visibility"
                        checked={newChannelVisibility === 'public'}
                        onChange={() => setNewChannelVisibility('public')}
                      />
                      Public - anyone in this workspace can discover and join.
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input
                        type="radio"
                        name="channel-visibility"
                        checked={newChannelVisibility === 'private'}
                        onChange={() => setNewChannelVisibility('private')}
                      />
                      Private - invite-only channel.
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assign to Team (Optional)</label>
                  <select 
                    value={selectedTeamId || ''} 
                    onChange={(e) => setSelectedTeamId(e.target.value || null)}
                    className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">No Team</option>
                    {workspace?.teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Members</label>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar border border-[#1e2028] rounded-lg p-2 bg-[#0d0e12] space-y-1">
                    {panelMembers
                      .filter((member) => member.user_id !== userId)
                      .map((member) => {
                        const checked = selectedChannelMemberIds.includes(member.user_id);
                        return (
                          <label key={member.user_id} className="flex items-center justify-between gap-2 text-xs text-[#cbd5e1] px-1.5 py-1 rounded hover:bg-[#0d0e12]">
                            <span className="truncate">{member.user_name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedChannelMemberIds((prev) =>
                                  e.target.checked
                                    ? [...prev, member.user_id]
                                    : prev.filter((id) => id !== member.user_id)
                                );
                              }}
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCreateChannel(false);
                      setSelectedChannelMemberIds([]);
                    }}
                    className="flex-1 bg-[#303236] hover:bg-[#404246] text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!newChannelName.trim() || isCreatingCommChannel}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    {isCreatingCommChannel ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreateTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111318] border border-[#1e2028] p-6 rounded-2xl w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">Create a Team</h2>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Team Name</label>
                  <div className="relative">
                    <Users2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input 
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full bg-[#0d0e12] border border-[#1e2028] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCreateTeam(false)}
                    className="flex-1 bg-[#303236] hover:bg-[#404246] text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!newTeamName.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    Create
                  </button>
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
            {(name || '?')[0]?.toUpperCase() || '?'}
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
  onVideoClick,
  onTerminateVideo,
  isVideoActive,
  onScheduleMeeting,
  onOpenIssue,
  onOpenDocs,
  onOpenIDE,
  onUploadFile,
}: {
  onSend: (text?: string, fileData?: any) => void;
  onVideoClick: () => void;
  onTerminateVideo: () => void;
  isVideoActive: boolean;
  onScheduleMeeting: () => void;
  onOpenIssue: () => void;
  onOpenDocs: () => void;
  onOpenIDE: () => void;
  onUploadFile?: (file: File) => Promise<{ url: string; name: string; type: string } | null>;
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commandPresets: Array<{ command: string; description: string }> = [
    { command: '/issue ', description: 'Link or create an issue thread' },
    { command: '/meet ', description: 'Schedule a meeting in this conversation' },
    { command: '/doc ', description: 'Attach or reference a document' },
    { command: '/task ', description: 'Create a task item from chat' },
    { command: '/status available', description: 'Set your presence quickly' },
  ];

  const isSlashInput = text.trim().startsWith('/');
  const slashFilter = text.trim().slice(1).toLowerCase();
  const filteredCommandPresets = commandPresets.filter((preset) =>
    preset.command.slice(1).toLowerCase().startsWith(slashFilter)
  );

  useEffect(() => {
    if (isSlashInput) {
      setShowSlashMenu(true);
      return;
    }
    setShowSlashMenu(false);
  }, [isSlashInput]);

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
      if (onUploadFile) {
        // Use Supabase Storage (or parent-provided upload handler)
        const data = await onUploadFile(file);
        if (data) onSend(undefined, data);
      } else {
        // Legacy Express fallback
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) onSend(undefined, data);
      }
    } catch (err) {
      console.error('Upload failed:', err);
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
            {filteredCommandPresets.map((preset) => (
              <button
                key={preset.command}
                type="button"
                onClick={() => {
                  setText(preset.command);
                  setShowSlashMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-[#cbd5e1] hover:bg-[#26272e]"
              >
                <span className="font-semibold text-white">{preset.command}</span>
                <span className="block text-[10px] text-[#94a3b8] mt-0.5">{preset.description}</span>
              </button>
            ))}
            {filteredCommandPresets.length === 0 && (
              <p className="px-2 py-1.5 text-[11px] text-[#64748b]">No matching command.</p>
            )}
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
        <div className="bg-[#16171d] border border-[#1e2028] rounded-xl overflow-hidden focus-within:border-indigo-500/60 transition-all">
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
            placeholder="Message… (Enter to send, Shift+Enter for new line)"
            className="w-full bg-transparent text-[14px] text-[#c5ccdb] px-4 pt-3 pb-2 min-h-[44px] max-h-[200px] focus:outline-none resize-none placeholder-[#3d4555]"
          />
          {isSlashInput && (
            <p className="px-4 pb-1.5 text-[11px] text-[#4b5563]">Press Enter to run command · Esc to dismiss</p>
          )}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1e2028]">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"
                title="Attach file"
              >
                <Plus size={16} />
              </button>
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 text-[#4b5563] hover:text-yellow-400 hover:bg-[#26272e] rounded-lg transition-all" title="Emoji">
                <Smile size={16} />
              </button>
              <button type="button" className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" title="Mention">
                <AtSign size={16} />
              </button>
              <button type="button" onClick={() => setShowSlashMenu((prev) => !prev)} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" title="Slash commands (/)">
                <ListTodo size={16} />
              </button>
              <button type="button" onClick={onVideoClick} className="p-1.5 text-[#4b5563] hover:text-indigo-400 hover:bg-[#26272e] rounded-lg transition-all" title="Start video / huddle">
                <Video size={16} />
              </button>
              <button type="button" className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" title="Voice message">
                <Mic size={16} />
              </button>
              <button type="button" onClick={onScheduleMeeting} className="p-1.5 text-[#4b5563] hover:text-white hover:bg-[#26272e] rounded-lg transition-all" title="Schedule meeting">
                <CalendarDays size={16} />
              </button>
              {isVideoActive && (
                <button type="button" onClick={onTerminateVideo} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all" title="End huddle">
                  <LogOut size={16} />
                </button>
              )}
            </div>
            <button 
              type="submit"
              disabled={!text.trim() || isUploading}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-all"
              title="Send (Enter)"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}



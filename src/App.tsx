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
  Map,
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
  ChevronDown
} from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useWebRTC } from './hooks/useWebRTC';
import { ChatMessage, User, Workspace, Channel, Team } from './types';
import { NEW_GLOBAL_NAV, NAVIGATION_TREE } from './constants';
import { supabase } from './lib/supabase';
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

export default function App() {
  const [userName, setUserName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('default-workspace');
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
  const [showSchema, setShowSchema] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>('messages');
  const [activeGlobalNav, setActiveGlobalNav] = useState('issues');
  const [activeSidebarItem, setActiveSidebarItem] = useState('assigned-to-me');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['issues']));

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
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {activeSidebarItem === 'messages' && (
              <div className="space-y-8 max-w-5xl mx-auto">
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
              <div className="max-w-5xl mx-auto py-10 opacity-40 text-center">
                <Pin size={48} className="mx-auto mb-4 text-[#94a3b8]" />
                <h4 className="text-xl font-bold text-white">No Pinned Messages</h4>
                <p className="text-[#94a3b8] mt-2">Messages pinned by the team will appear here.</p>
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
              </div>
            )}
          </div>

          {/* Input Area */}
          {activeSidebarItem === 'messages' && (
            <div className="p-6 bg-[#0d0e12] border-t border-[#26272e]">
              <div className="max-w-5xl mx-auto">
                <ChatInput onSend={handleSendMessage} onVideoClick={handleComposerVideoClick} />
              </div>
            </div>
          )}
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

    // Deterministic per-user workspace keeps identities isolated until workspace tables are migrated.
    const generatedWorkspaceId = `ws-${authUser.id.slice(0, 12)}`;

    setUserId(authUser.id);
    setUserName(resolvedName);
    setWorkspaceId(generatedWorkspaceId);
    setIsJoined(true);
    setAuthError(null);
  };

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


  // Fetch workspace and channels
  useEffect(() => {
    if (isJoined) {
      fetchWorkspace();
    }
  }, [isJoined, workspaceId]);

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

  // Fetch message history when channel changes
  useEffect(() => {
    if (currentChannel) {
      fetch(`/api/channels/${currentChannel.id}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error("Error fetching messages:", err));
    }
  }, [currentChannel]);

  useEffect(() => {
    if (isJoined && currentChannel) {
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
        if (type === 'chat') {
          setMessages((prev) => [...prev, payload]);
        }
      };

      setSocket(ws);
      return () => ws.close();
    }
  }, [isJoined, currentChannel, userId, userName, workspaceId]);

  const handleSendMessage = (text?: string, fileData?: any) => {
    if (socket && (text?.trim() || fileData)) {
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

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: newChannelName, teamId: selectedTeamId })
      });
      const data = await res.json();
      if (res.ok) {
        setNewChannelName('');
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
    // Create a unique room ID for private call
    const privateRoomId = [userId, user.id].sort().join('--');
    setCurrentChannel({
      id: privateRoomId,
      workspace_id: workspaceId,
      name: `DM: ${user.name}`
    });
    setMessages([]);
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
          <div className="mt-6 pt-6 border-t border-[#303236] flex justify-center">
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
                className="bg-[#222529] border border-[#303236] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-4 border-b border-[#303236] flex items-center justify-between bg-[#1a1d21]">
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
                          <div key={col.name} className="grid grid-cols-3 gap-2 text-sm font-mono bg-[#1a1d21] p-2 rounded border border-[#303236]">
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
          <button className="p-2.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-xl transition-all">
            <Plus size={22} />
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
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16171d] border border-[#26272e] rounded-xl text-[#94a3b8] hover:text-white cursor-pointer transition-all">
              <Users size={16} />
              <span className="text-xs font-bold">{participants.length + 1}</span>
              <ChevronRight size={14} className="rotate-90" />
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
              <button className="p-2 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-xl transition-all">
                <Info size={20} />
              </button>
            </div>
            <div className="h-6 w-px bg-[#26272e]" />
            <div className="flex items-center bg-[#16171d] border border-[#26272e] rounded-xl px-3 py-1.5 gap-2">
              <Search size={16} className="text-[#94a3b8]" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none text-xs text-white focus:outline-none w-48" />
            </div>
          </div>
        </header>

        {/* Page-Level Navigation Row */}
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
                  <div className="flex gap-4 h-full overflow-x-auto custom-scrollbar pb-2">
                    <div className="w-64 flex-shrink-0">
                      <VideoCard stream={localStream} name={`${userName} (You)`} isLocal muted />
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
                  <div className="flex justify-center mt-4 gap-4">
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
                    <button 
                      onClick={() => setIsVideoActive(false)}
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

          {/* Right Panel (Contextual) */}
          <AnimatePresence>
            {isChatOpen && activeSidebarItem === 'chat' && (
              <motion.section 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 350, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="bg-[#16171d] border-l border-[#26272e] flex flex-col flex-shrink-0 z-10"
              >
                <div className="h-[64px] border-b border-[#26272e] flex items-center justify-between px-6">
                  <h3 className="font-bold text-white text-lg tracking-tight">Details</h3>
                  <button onClick={() => setIsChatOpen(false)} className="text-[#94a3b8] hover:text-white p-1.5 hover:bg-[#26272e] rounded-lg transition-all">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {/* Channel Info */}
                  <div>
                    <h4 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-4">About</h4>
                    <div className="bg-[#0d0e12] rounded-xl p-4 border border-[#26272e]">
                      <p className="text-sm text-white font-bold mb-1">#{currentChannel?.name}</p>
                      <p className="text-xs text-[#94a3b8] leading-relaxed">This channel is for everything related to {currentChannel?.name}.</p>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">Members</h4>
                      <span className="text-[10px] font-bold text-indigo-400">{participants.length + 1}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                          {userName[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm text-white font-medium">{userName} (You)</span>
                      </div>
                      {participants.map(p => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#26272e] rounded-lg flex items-center justify-center text-white font-bold text-xs">
                            {p.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-[#cbd5e1] font-medium">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Unread Mentions Indicator (Bottom) */}
      </main>

      {/* Right Panel (Thread) */}
      <AnimatePresence>
        {isChatOpen && activeGlobalNav === 'chat' && (
          <motion.section 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-[#16171d] border-l border-[#26272e] flex flex-col flex-shrink-0 z-10"
          >
            <div className="h-[64px] border-b border-[#26272e] flex items-center justify-between px-6">
              <h3 className="font-bold text-white text-lg tracking-tight">Thread</h3>
              <button onClick={() => setIsChatOpen(false)} className="text-[#94a3b8] hover:text-white p-1.5 hover:bg-[#26272e] rounded-lg transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <div className="w-20 h-20 bg-[#26272e] rounded-3xl flex items-center justify-center mb-6">
                    <MessageSquare size={32} className="text-[#94a3b8]" />
                  </div>
                  <p className="text-[#94a3b8] font-medium">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="group flex gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/10">
                      {msg.userName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-bold text-white text-sm">{msg.userName}</span>
                        <span className="text-[10px] text-[#94a3b8] font-medium uppercase tracking-wider">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-[#cbd5e1] leading-relaxed break-words">{msg.text}</p>
                      {msg.file_url && (
                        <div className="mt-3 p-4 bg-[#26272e] border border-[#303236] rounded-2xl flex items-center gap-4 max-w-sm group/file hover:border-indigo-500/50 transition-all cursor-pointer">
                          <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
                            {msg.file_type?.startsWith('image/') ? <ImageIcon size={24} /> : <FileText size={24} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{msg.file_name}</p>
                            <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest">{msg.file_type?.split('/')[1] || 'FILE'}</p>
                          </div>
                          <a 
                            href={msg.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-[#94a3b8] hover:text-white transition-colors"
                          >
                            <ChevronRight size={20} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-[#26272e] bg-[#0d0e12]">
              <ChatInput onSend={handleSendMessage} onVideoClick={handleComposerVideoClick} />
            </div>
          </motion.section>
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
              className="bg-[#222529] border border-[#303236] p-6 rounded-2xl w-full max-w-sm shadow-2xl"
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
                      className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assign to Team (Optional)</label>
                  <select 
                    value={selectedTeamId || ''} 
                    onChange={(e) => setSelectedTeamId(e.target.value || null)}
                    className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">No Team</option>
                    {workspace?.teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCreateChannel(false)}
                    className="flex-1 bg-[#303236] hover:bg-[#404246] text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!newChannelName.trim()}
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

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreateTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#222529] border border-[#303236] p-6 rounded-2xl w-full max-w-sm shadow-2xl"
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
                      className="w-full bg-[#1a1d21] border border-[#303236] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
  key?: string | number;
}

function VideoCard({ stream, name, isLocal, muted }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-[#16171d] rounded-2xl overflow-hidden border border-[#26272e] aspect-video group shadow-2xl transition-all hover:border-indigo-500/30">
      {stream ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={muted}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
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

function ChatInput({ onSend, onVideoClick }: { onSend: (text?: string, fileData?: any) => void; onVideoClick: () => void }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        onSend(undefined, data);
      }
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
        <div className="bg-[#16171d] border border-[#26272e] rounded-2xl overflow-hidden focus-within:border-indigo-500 transition-all shadow-2xl">
          <div className="flex items-center gap-1 px-4 py-2 bg-[#0d0e12]/30 border-b border-[#26272e]">
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Plus size={18} /></button>
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Smile size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><AtSign size={18} /></button>
            <button type="button" onClick={onVideoClick} className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Video size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><Mic size={18} /></button>
            <button type="button" className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"><FileCode size={18} /></button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message #0-00-general"
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

import { Pin, ImageIcon, FileText, ExternalLink } from 'lucide-react';

interface Message {
  id: string;
  userId: string;
  userName: string;
  text?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  timestamp: number;
}

interface PresenceInfo {
  userId: string;
  status: 'online' | 'available' | 'out_of_office' | 'last_seen' | 'offline';
  online: boolean;
}

interface MessageListProps {
  messages: Message[];
  pinnedMessageIds: string[];
  presenceMap: Map<string, PresenceInfo>;
  onTogglePin: (messageId: string) => void;
  conversationType: 'channel' | 'dm';
  conversationName: string;
}

function getStatusColor(status: string): string {
  if (status === 'available') return 'bg-emerald-400';
  if (status === 'online') return 'bg-sky-400';
  if (status === 'out_of_office') return 'bg-orange-400';
  return 'bg-[#475569]';
}

export function MessageList({ messages, pinnedMessageIds, presenceMap, onTogglePin, conversationType, conversationName }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-40">
        <div className="w-24 h-24 bg-[#26272e] rounded-[2rem] flex items-center justify-center mb-8">
          <span className="text-4xl">{conversationType === 'channel' ? '#' : '💬'}</span>
        </div>
        <h4 className="text-xl font-bold text-white mb-2">
          {conversationType === 'channel' ? `Welcome to #${conversationName}` : `Direct message with ${conversationName}`}
        </h4>
        <p className="text-[#94a3b8] font-medium">
          {conversationType === 'channel' 
            ? 'This is the start of the conversation. Say hello!' 
            : 'This is the beginning of your direct message history.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-8">
      {messages.map((msg, idx) => {
        const prevMsg = messages[idx - 1];
        const isSameUser = prevMsg && prevMsg.userId === msg.userId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 300000);
        const presence = presenceMap.get(msg.userId);
        const isOnline = presence?.online || false;

        return (
          <div key={msg.id} className={`group flex gap-4 ${isSameUser ? '-mt-6' : ''}`}>
            {!isSameUser ? (
              <div className="relative w-10 h-10 flex-shrink-0">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/10">
                  {msg.userName[0]?.toUpperCase() || '?'}
                </div>
                {isOnline && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${getStatusColor(presence?.status || 'offline')} rounded-full border-2 border-[#16171d]`} />
                )}
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
                    onClick={() => onTogglePin(msg.id)}
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
              <p className="text-[15px] text-[#cbd5e1] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>

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
      })}
    </div>
  );
}

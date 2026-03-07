import { Send, Paperclip, Smile, AtSign } from 'lucide-react';
import { useState, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

interface InlineComposerProps {
  onSend: (text: string) => void;
  onUpload?: (file: File) => Promise<void>;
  placeholder?: string;
  conversationType: 'channel' | 'dm';
  conversationName: string;
}

export function InlineComposer({ onSend, onUpload, placeholder, conversationType, conversationName }: InlineComposerProps) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendCurrentMessage = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendCurrentMessage();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayName = conversationType === 'channel' ? `#${conversationName}` : conversationName;

  return (
    <div className="border-t border-[#26272e] bg-[#16171d] sticky bottom-0">
      <form onSubmit={handleSubmit} className="p-4">
        <div className="bg-[#1e1f26] border border-[#26272e] rounded-xl overflow-hidden focus-within:border-indigo-500/50 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCurrentMessage();
              }
            }}
            placeholder={placeholder || `Message ${displayName}`}
            className="w-full bg-transparent text-[15px] text-white p-4 min-h-[60px] max-h-[200px] focus:outline-none resize-none placeholder-[#475569]"
            rows={1}
          />
          <div className="flex items-center justify-between px-4 py-2 bg-[#0d0e12]/30">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all disabled:opacity-30"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"
                title="Add emoji"
              >
                <Smile size={18} />
              </button>
              <button
                type="button"
                className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all"
                title="Mention someone"
              >
                <AtSign size={18} />
              </button>
            </div>
            <button
              type="submit"
              disabled={!text.trim() || isUploading}
              className="text-[#94a3b8] hover:text-indigo-400 disabled:opacity-30 p-2 transition-all"
              title="Send message (Enter)"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#475569] mt-2 font-medium">
          <kbd className="px-1.5 py-0.5 bg-[#26272e] rounded text-[#94a3b8]">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-[#26272e] rounded text-[#94a3b8]">Shift+Enter</kbd> for new line
        </p>
      </form>
    </div>
  );
}

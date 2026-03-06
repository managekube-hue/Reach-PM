import React from 'react';
import { FileCode, FileText, ChevronRight, Play, Save, Search, GitBranch } from 'lucide-react';

export const IDEView = () => {
  return (
    <div className="flex-1 flex bg-[#0d0e12] overflow-hidden">
      {/* File Explorer */}
      <div className="w-64 border-r border-[#26272e] flex flex-col bg-[#16171d]">
        <div className="p-4 border-b border-[#26272e] flex items-center justify-between">
          <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">Explorer</span>
          <Search size={14} className="text-[#475569]" />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {[
            { name: 'src', type: 'folder' },
            { name: 'App.tsx', type: 'file' },
            { name: 'main.tsx', type: 'file' },
            { name: 'constants.ts', type: 'file' },
            { name: 'package.json', type: 'file' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-[#26272e] cursor-pointer group">
              {item.type === 'folder' ? <ChevronRight size={14} /> : <FileCode size={14} className="text-indigo-400" />}
              <span className="truncate">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="h-10 bg-[#1a1d21] border-b border-[#26272e] flex items-center px-4 gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0e12] border-t-2 border-indigo-500 text-xs font-bold text-white">
            <FileCode size={14} className="text-indigo-400" />
            App.tsx
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-[#475569] hover:text-white text-xs font-bold cursor-pointer">
            <FileCode size={14} />
            constants.ts
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button className="text-[#475569] hover:text-green-400 transition-colors">
              <Play size={16} />
            </button>
            <button className="text-[#475569] hover:text-indigo-400 transition-colors">
              <Save size={16} />
            </button>
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#475569] uppercase">
              <GitBranch size={12} />
              main
            </div>
          </div>
        </div>
        <div className="flex-1 bg-[#0d0e12] p-6 font-mono text-sm overflow-auto custom-scrollbar">
          <pre className="text-[#cbd5e1] leading-relaxed">
            {`import React, { useState } from 'react';
import { Layout } from 'lucide-react';

export default function App() {
  const [active, setActive] = useState(true);

  return (
    <div className="min-h-screen bg-black">
      <header className="p-4 border-b border-white/10">
        <h1 className="text-white font-bold">REACH</h1>
      </header>
      <main className="p-8">
        <p className="text-gray-400">Welcome to the future of work.</p>
      </main>
    </div>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

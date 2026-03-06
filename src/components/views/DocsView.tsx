import React from 'react';
import { FileText, ChevronRight, Hash, Clock, Users, Share2, MoreHorizontal } from 'lucide-react';

export const DocsView = () => {
  return (
    <div className="flex-1 flex bg-[#0d0e12] overflow-hidden">
      {/* Docs Sidebar */}
      <div className="w-64 border-r border-[#26272e] flex flex-col bg-[#16171d]">
        <div className="p-4 border-b border-[#26272e]">
          <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">Documentation</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {[
            { name: 'Getting Started', active: true },
            { name: 'API Reference' },
            { name: 'Design System' },
            { name: 'Release Notes' },
            { name: 'Security Policy' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              item.active ? 'bg-indigo-600/20 text-indigo-400 font-bold' : 'text-[#94a3b8] hover:text-white hover:bg-[#26272e]'
            } cursor-pointer`}>
              <FileText size={14} />
              <span className="truncate">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#0d0e12] p-12">
        <div className="max-w-3xl mx-auto w-full space-y-8">
          <div className="flex items-center gap-4 text-[10px] font-bold text-[#475569] uppercase tracking-widest">
            <div className="flex items-center gap-1"><Clock size={12} /> Updated 2h ago</div>
            <div className="flex items-center gap-1"><Users size={12} /> 4 Contributors</div>
            <div className="ml-auto flex items-center gap-4">
              <button className="hover:text-white transition-colors"><Share2 size={16} /></button>
              <button className="hover:text-white transition-colors"><MoreHorizontal size={16} /></button>
            </div>
          </div>

          <h1 className="text-5xl font-black text-white tracking-tighter">Getting Started</h1>
          
          <div className="flex items-center gap-2 p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <Hash size={20} />
            <p className="text-sm font-bold">This guide will help you set up your development environment.</p>
          </div>

          <div className="space-y-6 text-[#cbd5e1] leading-relaxed">
            <h2 className="text-2xl font-bold text-white tracking-tight">Prerequisites</h2>
            <p>Before you begin, ensure you have the following installed on your machine:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Node.js v18.0.0 or higher</li>
              <li>npm v9.0.0 or higher</li>
              <li>Git</li>
            </ul>

            <h2 className="text-2xl font-bold text-white tracking-tight">Installation</h2>
            <p>Clone the repository and install dependencies:</p>
            <div className="bg-[#16171d] p-4 rounded-xl font-mono text-sm border border-[#26272e]">
              <code className="text-indigo-400">git clone https://github.com/reach/app.git</code><br/>
              <code className="text-indigo-400">cd app</code><br/>
              <code className="text-indigo-400">npm install</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

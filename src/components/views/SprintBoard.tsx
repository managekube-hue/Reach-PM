import React from 'react';
import { Plus, MoreHorizontal, MessageSquare, Paperclip } from 'lucide-react';

const COLUMNS = [
  { id: 'todo', name: 'To Do', items: [
    { id: 'K-COR-001', title: 'Set up CI/CD pipeline', priority: 'High', sp: 5, comments: 2, attachments: 1 },
    { id: 'K-COR-002', title: 'Implement user authentication', priority: 'Critical', sp: 8, comments: 5, attachments: 3 },
  ]},
  { id: 'working', name: 'Working', items: [
    { id: 'K-COR-003', title: 'Design system audit', priority: 'Medium', sp: 3, comments: 1, attachments: 0 },
  ]},
  { id: 'done', name: 'Done', items: [
    { id: 'K-COR-004', title: 'API documentation', priority: 'Low', sp: 2, comments: 0, attachments: 2 },
  ]}
];

export const SprintBoard = () => {
  return (
    <div className="flex-1 flex bg-[#0d0e12] overflow-x-auto custom-scrollbar p-6 gap-6">
      {COLUMNS.map((column) => (
        <div key={column.id} className="w-80 flex-shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{column.name}</h3>
              <span className="text-xs font-bold text-[#475569] bg-[#16171d] px-2 py-0.5 rounded-full">{column.items.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all">
                <Plus size={16} />
              </button>
              <button className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4">
            {column.items.map((item) => (
              <div key={item.id} className="bg-[#16171d] border border-[#26272e] p-4 rounded-2xl hover:border-indigo-500/30 transition-all group cursor-pointer shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-widest">{item.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                    item.priority === 'Critical' ? 'bg-red-500/10 text-red-500' :
                    item.priority === 'High' ? 'bg-orange-500/10 text-orange-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {item.priority}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-4 leading-relaxed group-hover:text-indigo-400 transition-colors">{item.title}</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[#475569] group-hover:text-[#94a3b8] transition-colors">
                      <MessageSquare size={12} />
                      <span className="text-[10px] font-bold">{item.comments}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#475569] group-hover:text-[#94a3b8] transition-colors">
                      <Paperclip size={12} />
                      <span className="text-[10px] font-bold">{item.attachments}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white border-2 border-[#16171d]">
                      U
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-[#0d0e12] flex items-center justify-center text-[8px] font-bold text-[#475569] border border-[#26272e]">
                      {item.sp}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button className="w-full py-3 border border-dashed border-[#26272e] rounded-2xl text-[#475569] hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-xs font-bold flex items-center justify-center gap-2">
              <Plus size={14} />
              Add Item
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

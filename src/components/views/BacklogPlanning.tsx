import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, GripVertical } from 'lucide-react';

const BACKLOG_DATA = [
  {
    id: 'sprint-1',
    name: 'Sprint 1',
    status: 'Active',
    items: [
      { id: 'K-COR-001', title: 'Set up CI/CD pipeline', priority: 'High', sp: 5 },
      { id: 'K-COR-002', title: 'Implement user authentication', priority: 'Critical', sp: 8 },
    ]
  },
  {
    id: 'backlog',
    name: 'Product Backlog',
    status: 'Planning',
    items: [
      { id: 'K-COR-003', title: 'Design system audit', priority: 'Medium', sp: 3 },
      { id: 'K-COR-004', title: 'API documentation', priority: 'Low', sp: 2 },
      { id: 'K-COR-005', title: 'Mobile responsive fixes', priority: 'High', sp: 5 },
      { id: 'K-COR-006', title: 'Database migration', priority: 'Medium', sp: 13 },
    ]
  }
];

export const BacklogPlanning = () => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['sprint-1', 'backlog']));

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0d0e12] overflow-hidden p-6">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        {BACKLOG_DATA.map((section) => (
          <div key={section.id} className="space-y-2">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => toggle(section.id)}
            >
              {expanded.has(section.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <h3 className="text-lg font-bold text-white">{section.name}</h3>
              <span className="text-xs font-bold text-[#475569] uppercase tracking-widest ml-2">{section.items.length} items</span>
              <div className="flex-1 h-px bg-[#26272e] ml-4" />
              <button className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Plus size={16} />
              </button>
            </div>

            {expanded.has(section.id) && (
              <div className="space-y-1 ml-6">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-[#16171d] border border-[#26272e] rounded-xl hover:border-indigo-500/30 transition-all group cursor-pointer">
                    <GripVertical size={14} className="text-[#26272e] group-hover:text-[#475569] cursor-grab" />
                    <span className="text-xs font-bold text-indigo-400 font-mono w-20">{item.id}</span>
                    <span className="flex-1 text-sm font-bold text-white">{item.title}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        item.priority === 'Critical' ? 'text-red-500' :
                        item.priority === 'High' ? 'text-orange-500' :
                        'text-blue-500'
                      }`}>
                        {item.priority}
                      </span>
                      <div className="w-8 h-8 bg-[#0d0e12] rounded-lg flex items-center justify-center text-xs font-bold text-white border border-[#26272e]">
                        {item.sp}
                      </div>
                      <MoreHorizontal size={16} className="text-[#475569] hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                ))}
                <button className="w-full flex items-center gap-2 p-3 text-[#475569] hover:text-indigo-400 transition-all text-xs font-bold">
                  <Plus size={14} />
                  Add Item
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

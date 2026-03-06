import React from 'react';
import { MoreHorizontal, ChevronDown, Plus, Filter, Search, Download } from 'lucide-react';

const MOCK_DATA = [
  { id: 'K-COR-001', title: 'Set up CI/CD pipeline', status: 'Working', priority: 'High', type: 'Task', sp: 5, assignee: 'Unassigned', updated: '3/3/2026' },
  { id: 'K-COR-002', title: 'Implement user authentication', status: 'Done', priority: 'Critical', type: 'Feature', sp: 8, assignee: 'Alex Rivera', updated: '3/2/2026' },
  { id: 'K-COR-003', title: 'Design system audit', status: 'Stuck', priority: 'Medium', type: 'Task', sp: 3, assignee: 'Sam Chen', updated: '3/1/2026' },
  { id: 'K-COR-004', title: 'API documentation', status: 'Working', priority: 'Low', type: 'Docs', sp: 2, assignee: 'Jordan Lee', updated: '2/28/2026' },
  { id: 'K-COR-005', title: 'Mobile responsive fixes', status: 'Working', priority: 'High', type: 'Bug', sp: 5, assignee: 'Unassigned', updated: '2/27/2026' },
];

export const SprintTable = () => {
  return (
    <div className="flex-1 flex flex-col bg-[#0d0e12] overflow-hidden">
      {/* Table Header Actions */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#26272e]">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#16171d] border border-[#26272e] rounded-lg px-3 py-1.5 gap-2">
            <Search size={14} className="text-[#94a3b8]" />
            <input type="text" placeholder="Search issues..." className="bg-transparent border-none text-xs text-white focus:outline-none w-48" />
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-[#94a3b8] hover:text-white text-xs font-bold transition-all">
            <Filter size={14} />
            Filter
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#26272e] rounded-lg transition-all">
            <Download size={16} />
          </button>
          <button className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={14} />
            New Issue
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0d0e12] z-10">
            <tr className="border-b border-[#26272e]">
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-32">Key</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest">Title</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-32">Status</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-32">Priority</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-32">Type</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-16 text-center">SP</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-40">Assignee</th>
              <th className="px-6 py-3 text-[10px] font-black text-[#475569] uppercase tracking-widest w-32">Updated</th>
              <th className="px-6 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#26272e]">
            {MOCK_DATA.map((item) => (
              <tr key={item.id} className="hover:bg-[#16171d]/50 transition-all group cursor-pointer">
                <td className="px-6 py-4 text-xs font-bold text-indigo-400 font-mono">{item.id}</td>
                <td className="px-6 py-4 text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{item.title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                    item.status === 'Working' ? 'bg-indigo-500/10 text-indigo-400' :
                    item.status === 'Done' ? 'bg-green-500/10 text-green-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold ${
                    item.priority === 'Critical' ? 'text-red-500' :
                    item.priority === 'High' ? 'text-orange-500' :
                    item.priority === 'Medium' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-[#94a3b8] font-medium">{item.type}</td>
                <td className="px-6 py-4 text-xs text-center font-bold text-white">{item.sp}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white">
                      {item.assignee[0]}
                    </div>
                    <span className="text-xs text-[#cbd5e1] font-medium">{item.assignee}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-[#475569] font-medium">{item.updated}</td>
                <td className="px-6 py-4">
                  <MoreHorizontal size={16} className="text-[#475569] hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

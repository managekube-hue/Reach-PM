import React from 'react';
import { BarChart3, TrendingUp, Users, Clock, Zap, Target, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const DATA = [
  { name: 'Mon', value: 40 },
  { name: 'Tue', value: 30 },
  { name: 'Wed', value: 65 },
  { name: 'Thu', value: 45 },
  { name: 'Fri', value: 90 },
  { name: 'Sat', value: 70 },
  { name: 'Sun', value: 85 },
];

export const DashboardView = () => {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0d0e12]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Issues', value: '124', change: '+12%', icon: AlertCircle, color: 'text-orange-500' },
            { label: 'Cycle Time', value: '3.2d', change: '-8%', icon: Clock, color: 'text-indigo-400' },
            { label: 'Throughput', value: '42', change: '+18%', icon: Zap, color: 'text-yellow-500' },
            { label: 'Team Velocity', value: '85', change: '+5%', icon: TrendingUp, color: 'text-green-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#16171d] border border-[#26272e] p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl bg-[#0d0e12] border border-[#26272e] ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.change}
                </span>
              </div>
              <h4 className="text-xs font-bold text-[#475569] uppercase tracking-widest mb-1">{stat.label}</h4>
              <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#16171d] border border-[#26272e] rounded-2xl p-6 shadow-xl h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Issue Velocity Trend</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Completed Issues</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DATA}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#26272e" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#16171d', border: '1px solid #26272e', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 shadow-xl flex flex-col">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Recent Activity</h3>
            <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
              {[
                { user: 'Alex', action: 'completed', item: 'K-COR-001', time: '10m ago', icon: CheckCircle2, color: 'text-green-500' },
                { user: 'Sam', action: 'commented on', item: 'K-COR-003', time: '45m ago', icon: MessageSquare, color: 'text-indigo-400' },
                { user: 'Jordan', action: 'created', item: 'K-COR-005', time: '2h ago', icon: Plus, color: 'text-orange-500' },
                { user: 'Alex', action: 'moved', item: 'K-COR-002', time: '4h ago', icon: Target, color: 'text-yellow-500' },
              ].map((activity, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`w-8 h-8 rounded-xl bg-[#0d0e12] border border-[#26272e] flex items-center justify-center flex-shrink-0 ${activity.color}`}>
                    <activity.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#cbd5e1] leading-relaxed">
                      <span className="font-bold text-white">{activity.user}</span> {activity.action} <span className="font-bold text-indigo-400">{activity.item}</span>
                    </p>
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageSquare = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

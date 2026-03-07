import React, { useState } from 'react';

export function AdminPage({ currentRole, isAdminPortal, workspaceId }: { currentRole: string, isAdminPortal: boolean, workspaceId: string }) {
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-8 bg-[#0d0e12]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h2>
            <p className="text-[#94a3b8] text-sm mt-1">Manage profiles, workspace roles, and access views.</p>
          </div>
          <div className="px-3 py-1.5 bg-[#0d0e12] border border-[#303236] rounded-lg text-xs font-semibold text-[#cbd5e1] uppercase tracking-wide">
            Role: {currentRole}
          </div>
        </div>

        {roleUpdateError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
            {roleUpdateError}
          </div>
        )}

        <div className="bg-[#16171d] border border-[#26272e] rounded-2xl p-4 space-y-3">
          {/* Admin features extracted from App.tsx go here */}
          <p className="text-gray-400">Admin management workspace...</p>
        </div>
      </div>
    </div>
  );
}

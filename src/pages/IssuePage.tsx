import React from 'react';
import { SprintTable } from '../components/views/SprintTable';
import { SprintBoard } from '../components/views/SprintBoard';
import { BacklogPlanning } from '../components/views/BacklogPlanning';

export function IssuePage({ activeSidebarItem }: { activeSidebarItem: string }) {
  // Determine which sub-view to show
  const renderContent = () => {
    switch(activeSidebarItem) {
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
      default:
        return <SprintTable />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-0 bg-[#0d0e12]">
      {renderContent()}
    </div>
  );
}

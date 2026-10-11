import React from 'react';
import { useVault } from '../context/VaultContext';
import {
  Lock,
  Search,
  Plus,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeTab,
    searchQuery,
    setSearchQuery,
    openAddModal,
    lockVault,
    currentUser,
  } = useVault();

  const tabLabels = {
    personal: 'Personal passwords',
    shared: 'Shared passwords',
    categories: 'My categories',
  };

  return (
    <header className="hidden md:flex h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30 px-6 items-center justify-between gap-4">
      {/* Tab Context Indicator */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="text-slate-400 font-normal">Keynest</span>
        <span className="text-slate-300 font-normal">/</span>
        <span className="text-indigo-600">{tabLabels[activeTab]}</span>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts or usernames..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Add password button */}
        <button
          onClick={() => openAddModal(activeTab === 'shared')}
          className="flex items-center gap-1.5 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add password</span>
        </button>

        {/* Lock button */}
        <button
          onClick={lockVault}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
          title="Lock your vault"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* User initials */}
        {currentUser && (
          <div
            className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs"
            title={currentUser.name}
          >
            {currentUser.initials}
          </div>
        )}
      </div>
    </header>
  );
};

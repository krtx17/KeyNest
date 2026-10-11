import React from 'react';
import { useVault, MainTab } from '../context/VaultContext';
import {
  Lock,
  Users,
  Folder,
  Plus,
  KeyRound,
  LogOut,
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectItem,
    setSelectedCategoryId,
    openAddModal,
    lockVault,
    signOut,
    currentUser,
  } = useVault();

  const handleNavClick = (tab: MainTab) => {
    setActiveTab(tab);
    selectItem(null);
    setSelectedCategoryId(null);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <KeyRound className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-900 text-base">Keynest</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={lockVault}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 text-xs flex items-center gap-1"
            title="Lock vault"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-medium">Lock</span>
          </button>
          <button
            onClick={signOut}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Bar: Personal, Shared, Add, Categories */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-3 py-2 flex items-center justify-around shadow-lg">
        {/* 1. Personal */}
        <button
          onClick={() => handleNavClick('personal')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'personal' ? 'text-indigo-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Lock className="w-5 h-5" />
          <span>Personal</span>
        </button>

        {/* Floating Add Password Button */}
        <div className="relative -top-2">
          <button
            onClick={() => openAddModal(activeTab === 'shared')}
            className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
            aria-label="Add password"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 2. Shared */}
        <button
          onClick={() => handleNavClick('shared')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'shared' ? 'text-indigo-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Shared</span>
        </button>

        {/* 3. Categories */}
        <button
          onClick={() => handleNavClick('categories')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'categories' ? 'text-indigo-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Folder className="w-5 h-5" />
          <span>Categories</span>
        </button>
      </nav>
    </>
  );
};

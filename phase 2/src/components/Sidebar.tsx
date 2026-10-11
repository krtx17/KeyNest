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

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectItem,
    setSelectedCategoryId,
    items,
    categories,
    openAddModal,
    lockVault,
    signOut,
    currentUser,
  } = useVault();

  const personalCount = items.filter((i) => !i.isShared).length;
  const sharedCount = items.filter((i) => i.isShared).length;
  const categoriesCount = categories.length;

  const handleNavClick = (tab: MainTab) => {
    setActiveTab(tab);
    selectItem(null);
    setSelectedCategoryId(null);
  };

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
          <KeyRound className="w-4 h-4" />
        </div>
        <span className="font-bold text-slate-900 tracking-tight text-lg">Keynest</span>
      </div>

      {/* Main Action: Add password */}
      <div className="p-4 pb-2">
        <button
          onClick={() => openAddModal(activeTab === 'shared')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add password</span>
        </button>
      </div>

      {/* 3 Main Navigation Tabs */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {/* 1. Personal */}
        <button
          onClick={() => handleNavClick('personal')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'personal'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                activeTab === 'personal'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
            </div>
            <span>Personal</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activeTab === 'personal'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {personalCount}
          </span>
        </button>

        {/* 2. Shared */}
        <button
          onClick={() => handleNavClick('shared')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'shared'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                activeTab === 'shared'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>Shared</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activeTab === 'shared'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {sharedCount}
          </span>
        </button>

        {/* 3. Categories */}
        <button
          onClick={() => handleNavClick('categories')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'categories'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                activeTab === 'categories'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
            </div>
            <span>Categories</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activeTab === 'categories'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {categoriesCount}
          </span>
        </button>
      </nav>

      {/* Safety & Account Controls Footer */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {/* Lock button */}
        <button
          onClick={lockVault}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold transition-colors"
          title="Lock your vault"
        >
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Lock vault</span>
        </button>

        {/* User Card with Sign out */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.initials}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

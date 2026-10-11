import React from 'react';
import { useVault } from '../context/VaultContext';
import { VaultItem } from '../types/vault';
import {
  Plus,
  Search,
  Copy,
  ChevronRight,
  Users,
  Lock,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const VaultHome: React.FC = () => {
  const {
    activeTab,
    items,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    selectItem,
    openAddModal,
    openShareModal,
    copyPassword,
    teammates,
  } = useVault();

  const isSharedTab = activeTab === 'shared';

  // Filter items by personal vs shared
  let tabItems = items.filter((item) => (isSharedTab ? item.isShared : !item.isShared));

  // Category filter
  if (selectedCategoryId) {
    tabItems = tabItems.filter((item) => item.categoryId === selectedCategoryId);
  }

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    tabItems = tabItems.filter((item) => {
      const matchName = item.serviceName.toLowerCase().includes(q);
      const matchUser = item.username.toLowerCase().includes(q);
      const matchUrl = item.url?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      const cat = categories.find((c) => c.id === item.categoryId);
      const matchCat = cat?.name.toLowerCase().includes(q);
      return matchName || matchUser || matchUrl || matchNotes || matchCat;
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            {isSharedTab ? 'Shared passwords' : 'Personal passwords'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSharedTab
              ? 'Logins shared with selected teammates.'
              : 'A private place for your own logins.'}
          </p>
        </div>

        <button
          onClick={() => openAddModal(isSharedTab)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add password</span>
        </button>
      </div>

      {/* Shared Passwords Requirement: Clear reminder about password access */}
      {isSharedTab && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
            !
          </div>
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-900">Sharing reminder</p>
            <p className="text-amber-800 leading-relaxed">
              Removing access cannot erase a password someone has already seen or copied.
              If a teammate leaves or no longer needs access, be sure to change the password on the website.
            </p>
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            selectedCategoryId === null
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({items.filter((i) => (isSharedTab ? i.isShared : !i.isShared)).length})
        </button>

        {categories.map((cat) => {
          const count = items.filter(
            (i) => (isSharedTab ? i.isShared : !i.isShared) && i.categoryId === cat.id
          ).length;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                isSelected
                  ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.name}</span>
              <span className="text-[11px] text-slate-400 font-normal">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Passwords Grid / Cards matching SVG reference */}
      {tabItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
            {isSharedTab ? <Users className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {searchQuery
              ? 'No matching passwords found'
              : isSharedTab
              ? 'No shared passwords yet'
              : 'No personal passwords yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with different keywords or clearing your category filter.'
              : isSharedTab
              ? 'Share a password with your teammates to collaborate easily.'
              : 'Add your first personal password to keep it safe and easy to find.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => openAddModal(isSharedTab)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
            >
              Add password
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tabItems.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);

            return (
              <div
                key={item.id}
                onClick={() => selectItem(item.id)}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-xs transition-all p-5 flex flex-col justify-between cursor-pointer space-y-4"
              >
                {/* Card Top: Icon, Title, Category Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.iconBg || '#6366F1' }}
                    >
                      {item.iconInitials || item.serviceName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">
                        {item.serviceName}
                      </h3>
                      {cat ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md mt-0.5"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            color: cat.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Uncategorized</span>
                      )}
                    </div>
                  </div>

                  <span className="text-slate-400 hover:text-indigo-600 p-1">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>

                {/* Card Middle: Username & Hidden Password */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Username
                    </span>
                    <p className="text-xs font-medium text-slate-700 truncate mt-0.5">
                      {item.username}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Password
                    </span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm text-slate-400 tracking-widest font-mono">
                        ••••••••••••
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPassword(item.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Copy password"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Shared members or view detail */}
                {isSharedTab && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Shared with:</span>
                      {item.sharedWith.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No one yet</span>
                      ) : (
                        <div className="flex -space-x-1.5">
                          {item.sharedWith.map((share) => {
                            const tm = teammates.find((t) => t.id === share.teammateId);
                            return (
                              <div
                                key={share.teammateId}
                                className="w-5 h-5 rounded-full border border-white flex items-center justify-center font-bold text-[9px] text-slate-700 shadow-2xs"
                                style={{ backgroundColor: tm?.avatarBg || '#E2E8F0' }}
                                title={`${tm?.name || 'Teammate'} (${share.permission === 'edit' ? 'Can edit' : 'Can view & copy'})`}
                              >
                                {tm?.initials || 'TM'}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectItem(item.id);
                        openShareModal();
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Manage access
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

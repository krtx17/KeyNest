import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { Category, VaultItem } from '../types/vault';
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const CategoryView: React.FC = () => {
  const {
    categories,
    items,
    openCategoryModal,
    deleteCategory,
    selectItem,
    copyPassword,
  } = useVault();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );

  const selectedCategory = categories.find((c) => c.id === activeCategoryId);
  const categoryItems = items.filter((i) => i.categoryId === activeCategoryId);

  const handleDelete = (cat: Category) => {
    const count = items.filter((i) => i.categoryId === cat.id).length;
    const confirmMsg = count > 0
      ? `Delete "${cat.name}"? The ${count} passwords in this category will become uncategorized, not deleted.`
      : `Delete category "${cat.name}"?`;
    if (window.confirm(confirmMsg)) {
      deleteCategory(cat.id);
      if (activeCategoryId === cat.id) {
        const remaining = categories.filter((c) => c.id !== cat.id);
        setActiveCategoryId(remaining[0]?.id || null);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My categories</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize personal and shared logins into your own custom categories.
          </p>
        </div>
        <button
          onClick={() => openCategoryModal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New category</span>
        </button>
      </div>

      {/* Categories Grid or Empty State */}
      {categories.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Folder className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No categories created yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Categories are optional. Create your own categories like "Work", "Community", or "Personal" to organize your logins.
          </p>
          <div className="pt-2">
            <button
              onClick={() => openCategoryModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create your first category</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {categories.map((cat) => {
            const count = items.filter((i) => i.categoryId === cat.id).length;
            const isSelected = activeCategoryId === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/50 border-indigo-300 shadow-xs ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <h3 className="font-bold text-sm text-slate-900 truncate">{cat.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-80 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openCategoryModal(cat)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-colors"
                      title="Rename category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{count} {count === 1 ? 'password' : 'passwords'}</span>
                  {isSelected && (
                    <span className="text-indigo-600 font-semibold text-[11px]">Viewing →</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Passwords in selected category */}
      {selectedCategory && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedCategory.color }}
            />
            <h2 className="text-lg font-bold text-slate-900">
              Passwords in {selectedCategory.name}
            </h2>
            <span className="text-xs text-slate-400 ml-1">
              ({categoryItems.length})
            </span>
          </div>

          {categoryItems.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Folder className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No passwords in this category yet</p>
              <p className="text-xs text-slate-400">
                You can assign this category when adding or editing a personal or shared password.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  className="p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.iconBg || '#6366F1' }}
                    >
                      {item.iconInitials || item.serviceName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {item.serviceName}
                        </p>
                        {item.isShared ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <Users className="w-2.5 h-2.5" />
                            Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Lock className="w-2.5 h-2.5" />
                            Personal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{item.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPassword(item.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

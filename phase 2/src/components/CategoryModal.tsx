import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { X, Folder } from 'lucide-react';

const COLOR_OPTIONS = [
  '#E1306C', // Pink/Instagram
  '#0D9488', // Teal/Work
  '#F97316', // Orange/Community
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Rose
  '#3B82F6', // Blue
  '#10B981', // Emerald
];

export const CategoryModal: React.FC = () => {
  const {
    isCategoryModalOpen,
    closeCategoryModal,
    editingCategory,
    addCategory,
    renameCategory,
  } = useVault();

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setColor(editingCategory.color);
    } else {
      setName('');
      setColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]);
    }
  }, [editingCategory, isCategoryModalOpen]);

  if (!isCategoryModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCategory) {
      renameCategory(editingCategory.id, name.trim());
    } else {
      addCategory(name.trim(), color);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-sm w-full p-6 space-y-5 animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: color }}
            >
              <Folder className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {editingCategory ? 'Rename category' : 'New category'}
            </h3>
          </div>
          <button
            onClick={closeCategoryModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Category name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Instagram, Work, Community"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {!editingCategory && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Color tag
              </label>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeCategoryModal}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {editingCategory ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

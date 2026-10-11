import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  X,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Users,
} from 'lucide-react';

export const AddEditModal: React.FC = () => {
  const {
    isAddModalOpen,
    isEditModalOpen,
    closeAddModal,
    closeEditModal,
    addItem,
    updateItem,
    selectedItemId,
    items,
    categories,
    defaultAddShared,
  } = useVault();

  const isOpen = isAddModalOpen || isEditModalOpen;
  const isEditing = isEditModalOpen && Boolean(selectedItemId);
  const editingItem = isEditing ? items.find((i) => i.id === selectedItemId) : null;

  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isShared, setIsShared] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setServiceName(editingItem.serviceName);
      setUrl(editingItem.url || '');
      setUsername(editingItem.username);
      setPassword(editingItem.password);
      setNotes(editingItem.notes || '');
      setCategoryId(editingItem.categoryId || '');
      setIsShared(editingItem.isShared);
    } else {
      setServiceName('');
      setUrl('');
      setUsername('');
      setPassword('');
      setNotes('');
      setCategoryId(categories[0]?.id || '');
      setIsShared(defaultAddShared);
    }
    setShowPassword(false);
  }, [editingItem, isEditing, defaultAddShared, isOpen, categories]);

  if (!isOpen) return null;

  const generateStrongPassword = () => {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let result = '';
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      result += chars[array[i] % chars.length];
    }
    setPassword(result);
    setShowPassword(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !username.trim() || !password.trim()) return;

    if (isEditing && editingItem) {
      updateItem(editingItem.id, {
        serviceName: serviceName.trim(),
        url: url.trim() || undefined,
        username: username.trim(),
        password,
        notes: notes.trim() || undefined,
        categoryId: categoryId || undefined,
        isShared,
      });
    } else {
      addItem({
        serviceName: serviceName.trim(),
        url: url.trim() || undefined,
        username: username.trim(),
        password,
        notes: notes.trim() || undefined,
        categoryId: categoryId || undefined,
        isShared,
      });
    }
  };

  const handleClose = () => {
    if (isEditing) {
      closeEditModal();
    } else {
      closeAddModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-lg w-full p-6 md:p-8 space-y-6 animate-in fade-in-50 zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {isEditing ? 'Edit password' : 'Add password'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update your login information.'
                : 'Save a new account to your vault.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Storage Type: Personal vs Shared */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Where to save
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsShared(false)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  !isShared
                    ? 'bg-indigo-50/80 border-indigo-300 text-indigo-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lock className="w-4 h-4 text-indigo-600" />
                <div className="text-left">
                  <p>Personal</p>
                  <p className="text-[10px] text-slate-400 font-normal">Private to you</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsShared(true)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  isShared
                    ? 'bg-indigo-50/80 border-indigo-300 text-indigo-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <div className="text-left">
                  <p>Shared</p>
                  <p className="text-[10px] text-slate-400 font-normal">Share with team</p>
                </div>
              </button>
            </div>
          </div>

          {/* Service Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Account name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Instagram, Work Email, GitHub"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Website / URL */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Website URL (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Username or Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Username or email *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. user@example.com or username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Password with Generator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Password *
              </label>
              <button
                type="button"
                onClick={generateStrongPassword}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Suggest strong password</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            >
              <option value="">None (Uncategorized)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add any helpful instructions or recovery notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {isEditing ? 'Save changes' : 'Add password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

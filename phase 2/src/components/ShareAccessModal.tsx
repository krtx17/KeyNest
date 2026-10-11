import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { SharePermission } from '../types/vault';
import {
  X,
  Check,
  Users,
  Eye,
  Edit2,
  Trash2,
  Plus,
  UserPlus,
} from 'lucide-react';

export const ShareAccessModal: React.FC = () => {
  const {
    items,
    selectedItemId,
    teammates,
    addTeammate,
    isShareModalOpen,
    closeShareModal,
    shareItem,
    removeShare,
  } = useVault();

  const item = items.find((i) => i.id === selectedItemId);

  const [selectedTeammateId, setSelectedTeammateId] = useState<string>(
    teammates[0]?.id || ''
  );
  const [permission, setPermission] = useState<SharePermission>('view_copy');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  if (!isShareModalOpen || !item) return null;

  const isAlreadyShared = item.sharedWith.some((s) => s.teammateId === selectedTeammateId);

  const handleAddNewTeammate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const added = addTeammate(newName.trim(), newEmail.trim());
    setSelectedTeammateId(added.id);
    setNewEmail('');
    setNewName('');
    setShowAddForm(false);
  };

  const handleShare = () => {
    if (!selectedTeammateId) return;
    shareItem(item.id, selectedTeammateId, permission);
  };

  const handleRemoveExisting = (teammateId: string) => {
    removeShare(item.id, teammateId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-lg w-full p-6 md:p-8 space-y-6 animate-in fade-in-50 zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Share access</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose who can use <span className="font-semibold text-slate-700">{item.serviceName}</span>.
            </p>
          </div>
          <button
            onClick={closeShareModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Step 1: Select or Add Teammate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                1. Select teammate
              </label>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add teammate</span>
                </button>
              )}
            </div>

            {/* Add Teammate Inline Form */}
            {showAddForm && (
              <form onSubmit={handleAddNewTeammate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-800">Add a teammate to share with</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Teammate name (optional)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <input
                    type="email"
                    required
                    placeholder="teammate@example.com *"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                  >
                    Add & Select
                  </button>
                </div>
              </form>
            )}

            {teammates.length === 0 && !showAddForm ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                <Users className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No teammates added yet.</p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add your first teammate</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {teammates.map((tm) => {
                  const isSelected = selectedTeammateId === tm.id;
                  const shareRecord = item.sharedWith.find((s) => s.teammateId === tm.id);

                  return (
                    <div
                      key={tm.id}
                      onClick={() => setSelectedTeammateId(tm.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200 shadow-2xs'
                          : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-slate-800 shrink-0"
                          style={{ backgroundColor: tm.avatarBg }}
                        >
                          {tm.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{tm.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{tm.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {shareRecord ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Has access
                          </span>
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Choose Permission */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Choose permission
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPermission('view_copy')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  permission === 'view_copy'
                    ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-0.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Can view & copy</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Can use the password, cannot edit details.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPermission('edit')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  permission === 'edit'
                    ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-0.5">
                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Can edit</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Can update the password and details.
                </p>
              </button>
            </div>
          </div>

          {/* Sharing Reminder Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              !
            </div>
            <p className="text-[11px] leading-relaxed">
              <strong>Reminder:</strong> A teammate may copy or remember this password.
              Removing their access later cannot erase what they have already seen. You may need to change the password on the website.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {isAlreadyShared ? (
            <button
              type="button"
              onClick={() => handleRemoveExisting(selectedTeammateId)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove their access</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeShareModal}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedTeammateId}
              onClick={handleShare}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {isAlreadyShared ? 'Update permission' : 'Share access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

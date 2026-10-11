import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  Copy,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ArrowLeft,
  Users,
  AlertTriangle,
  ExternalLink,
  Plus,
  UserX,
} from 'lucide-react';

export const CredentialDetail: React.FC = () => {
  const {
    items,
    selectedItemId,
    selectItem,
    categories,
    teammates,
    openEditModal,
    openShareModal,
    deleteItem,
    copyPassword,
    copyText,
    removeShare,
    currentUser,
  } = useVault();

  const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  const item = items.find((i) => i.id === selectedItemId);

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-slate-500 text-sm">Password entry not found.</p>
        <button
          onClick={() => selectItem(null)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Return to passwords
        </button>
      </div>
    );
  }

  const category = categories.find((c) => c.id === item.categoryId);

  const handleDelete = () => {
    if (window.confirm(`Delete password for "${item.serviceName}"? This cannot be undone.`)) {
      deleteItem(item.id);
    }
  };

  const handleCopyUsername = async () => {
    await copyText(item.username, 'Username');
    setCopiedField('username');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyPassword = async () => {
    await copyPassword(item.id);
    setCopiedField('password');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Back button and actions bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => selectItem(null)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to passwords</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout matching ui-02-login-detail.svg */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Password Details Card (8 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-6">
          {/* Header with Icon, Name, URL, Category */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-xs"
              style={{ backgroundColor: item.iconBg || '#6366F1' }}
            >
              {item.iconInitials || item.serviceName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{item.serviceName}</h1>
              {item.url && (
                <a
                  href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5 truncate"
                >
                  <span>{item.url.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
              {category && (
                <div className="mt-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${category.color}15`,
                      color: category.color,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Username Section */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Username or Email
            </label>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-sm font-semibold text-slate-800 break-all select-all">
                {item.username}
              </span>
              <button
                onClick={handleCopyUsername}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1 shrink-0 ml-2 transition-colors"
                title="Copy username"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{copiedField === 'username' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Password Section (Hidden by default until revealed) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Password
              </label>
              <span className="text-[11px] text-slate-400">
                {isPasswordRevealed ? 'Visible' : 'Hidden for safety'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="truncate pr-2">
                {isPasswordRevealed ? (
                  <span className="text-sm font-mono font-semibold text-slate-900 select-all">
                    {item.password}
                  </span>
                ) : (
                  <span className="text-base text-slate-400 tracking-widest font-mono">
                    ••••••••••••••••
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsPasswordRevealed(!isPasswordRevealed)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
                  title={isPasswordRevealed ? 'Hide password' : 'Show password'}
                >
                  {isPasswordRevealed ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reveal</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyPassword}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 transition-colors"
                  title="Copy password to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedField === 'password' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {item.notes && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Notes
              </label>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80 whitespace-pre-wrap leading-relaxed">
                {item.notes}
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Added on {item.createdAt}</span>
            <span>Last updated {item.updatedAt}</span>
          </div>
        </div>

        {/* Right Column: Shared Access & Safety Notice (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Shared with Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Who can access this login</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Teammates with access to this password</p>
              </div>
              <button
                onClick={openShareModal}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                title="Share with another person"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>

            {/* Access List */}
            <div className="space-y-2.5">
              {/* Current user (Owner) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{currentUser.name} (You)</p>
                    <p className="text-[10px] text-slate-400">Owner</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-slate-200/70">
                  Full control
                </span>
              </div>

              {/* Shared Teammates */}
              {item.sharedWith.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 space-y-1">
                  <p>Not shared with any teammates yet.</p>
                  <button
                    onClick={openShareModal}
                    className="text-indigo-600 font-semibold hover:underline"
                  >
                    Share with a teammate →
                  </button>
                </div>
              ) : (
                item.sharedWith.map((share) => {
                  const tm = teammates.find((t) => t.id === share.teammateId);
                  const isEdit = share.permission === 'edit';

                  return (
                    <div
                      key={share.teammateId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-slate-800 shrink-0"
                          style={{ backgroundColor: tm?.avatarBg || '#E2E8F0' }}
                        >
                          {tm?.initials || 'TM'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">
                            {tm?.name || 'Teammate'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {isEdit ? 'Can edit' : 'Can view & copy'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => removeShare(item.id, share.teammateId)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove access"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={openShareModal}
              className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs transition-colors"
            >
              ＋ Manage access
            </button>
          </div>

          {/* Simple safety reminder card matching user requirements & SVG */}
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs">
                !
              </div>
              <h4 className="font-bold text-xs text-amber-900">Sharing reminder</h4>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Removing access cannot erase a password someone has already seen or copied.
              If a teammate leaves, change this password on the website to keep the account safe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

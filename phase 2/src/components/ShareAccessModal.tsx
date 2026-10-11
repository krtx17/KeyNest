import React, { useState, useEffect, useCallback } from 'react';
import { useVault } from '../context/VaultContext';
import { SharePermission, ItemInvitation } from '../types/vault';
import {
  X,
  Eye,
  Edit2,
  Trash2,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

export const ShareAccessModal: React.FC = () => {
  const {
    items,
    selectedItemId,
    teammates,
    isShareModalOpen,
    closeShareModal,
    removeShare,
    sendItemInvite,
    listItemInvites,
    cancelItemInvite,
  } = useVault();

  const item = items.find((i) => i.id === selectedItemId);

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('view_copy');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<ItemInvitation[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!item) return;
    setIsLoadingInvites(true);
    try {
      const list = await listItemInvites(item.id);
      setInvitations(list);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [item, listItemInvites]);

  useEffect(() => {
    if (isShareModalOpen && item) {
      setRecipientName('');
      setRecipientEmail('');
      setPermission('view_copy');
      setErrorMessage(null);
      setSuccessMessage(null);
      loadInvites();
    }
  }, [isShareModalOpen, item, loadInvites]);

  if (!isShareModalOpen || !item) return null;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await sendItemInvite(
      item.id,
      recipientName.trim() || recipientEmail.split('@')[0],
      recipientEmail.trim(),
      permission,
      item.serviceName
    );

    setIsSending(false);

    if (result.success) {
      setSuccessMessage(`Email invitation sent to ${recipientEmail.trim()}.`);
      setRecipientName('');
      setRecipientEmail('');
      loadInvites();
    } else {
      setErrorMessage(result.error || 'Failed to dispatch email invitation.');
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    await cancelItemInvite(item.id, invitationId);
    loadInvites();
  };

  const handleRemoveAccess = (teammateId: string) => {
    removeShare(item.id, teammateId);
    loadInvites();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-lg w-full p-6 md:p-8 space-y-6 animate-in fade-in-50 zoom-in-95 duration-150 my-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Share password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a secure email invitation for{' '}
              <span className="font-semibold text-slate-700">{item.serviceName}</span>.
            </p>
          </div>
          <button
            onClick={closeShareModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form: Send Email Invitation */}
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              1. Recipient Details
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Email address *</label>
                <input
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Access Level */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              2. Access Level
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

          {/* Error Message banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <strong>Cannot send invitation:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Success Message banner */}
          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Send Invitation Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSending || !recipientEmail.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending invitation...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send email invitation</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Existing Invitations and Access */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              People with access & invitations
            </label>
            {isLoadingInvites && (
              <span className="text-[10px] text-slate-400">Updating...</span>
            )}
          </div>

          {invitations.length === 0 && item.sharedWith.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No pending invitations or shared teammates for this password.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {/* Active invitations */}
              {invitations.map((inv) => {
                const isPending = inv.status === 'pending';
                const isAccepted = inv.status === 'accepted';
                const isExpired = inv.status === 'expired';
                const isRevoked = inv.status === 'revoked';

                return (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 truncate">
                          {inv.recipientName || inv.recipientEmail}
                        </span>
                        {/* Status Chip */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Accepted</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold text-[10px]">
                            <AlertCircle className="w-3 h-3" />
                            <span>Expired</span>
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold text-[10px]">
                            <XCircle className="w-3 h-3" />
                            <span>Revoked</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {inv.recipientEmail} •{' '}
                        {inv.permission === 'edit' ? 'Can edit' : 'Can view & copy'}
                      </p>
                    </div>

                    <div>
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel invitation
                        </button>
                      )}
                      {isAccepted && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Remove access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Existing legacy shared teammates if any */}
              {item.sharedWith
                .filter((s) => !invitations.some((inv) => inv.status === 'accepted'))
                .map((share) => {
                  const tm = teammates.find((t) => t.id === share.teammateId);
                  return (
                    <div
                      key={share.teammateId}
                      className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-800">
                          {tm?.name || 'Teammate'}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {tm?.email} •{' '}
                          {share.permission === 'edit' ? 'Can edit' : 'Can view & copy'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAccess(share.teammateId)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove access</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Security & Access Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Important notice:</strong> A teammate may copy or remember this password.
            Removing their access later cannot erase what they have already seen or saved.
            If access is revoked, consider updating the password on the actual website.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={closeShareModal}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

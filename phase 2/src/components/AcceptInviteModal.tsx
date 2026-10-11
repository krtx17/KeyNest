import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { VerifiedInvitationInfo } from '../types/vault';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  LogOut,
} from 'lucide-react';

export const AcceptInviteModal: React.FC = () => {
  const {
    currentUser,
    pendingInviteToken,
    setPendingInviteToken,
    verifyInviteToken,
    acceptInviteToken,
    signOut,
  } = useVault();

  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<VerifiedInvitationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingInviteToken) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    verifyInviteToken(pendingInviteToken).then((info) => {
      if (!isMounted) return;
      setIsLoading(false);
      if (!info) {
        setErrorMsg('Invalid or unknown invitation link.');
        return;
      }
      setInviteInfo(info);
      if (!info.isValid) {
        if (info.status === 'revoked') {
          setErrorMsg('This invitation was revoked by the sender.');
        } else if (info.status === 'expired') {
          setErrorMsg('This invitation link has expired.');
        } else if (info.status === 'accepted') {
          setErrorMsg('This invitation has already been accepted.');
        } else {
          setErrorMsg('This invitation is no longer active.');
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pendingInviteToken, verifyInviteToken]);

  if (!pendingInviteToken) return null;

  const handleDismiss = () => {
    setPendingInviteToken(null);
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleAccept = async () => {
    if (!pendingInviteToken) return;
    setIsAccepting(true);
    setErrorMsg(null);

    const result = await acceptInviteToken(pendingInviteToken);
    setIsAccepting(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to accept invitation.');
    }
  };

  const isEmailMatching =
    currentUser &&
    inviteInfo &&
    currentUser.email.trim().toLowerCase() === inviteInfo.recipientEmail.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50 duration-150">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 md:p-8 space-y-6 my-6 text-center">
        {/* Loading state */}
        {isLoading && (
          <div className="py-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto">
              <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Verifying invitation</h3>
              <p className="text-xs text-slate-500 mt-1">Please wait while we verify your invitation link...</p>
            </div>
          </div>
        )}

        {/* Error / Invalid / Expired / Revoked */}
        {!isLoading && errorMsg && (
          <div className="py-4 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Unable to accept invitation</h3>
              <p className="text-xs text-rose-600 mt-1 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Go to KeyNest
              </button>
            </div>
          </div>
        )}

        {/* Valid Invitation */}
        {!isLoading && !errorMsg && inviteInfo && (
          <div className="space-y-5 text-left">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Password shared with you
              </h3>
              <p className="text-xs text-slate-500">
                <strong className="text-slate-700">{inviteInfo.senderName}</strong>{' '}
                ({inviteInfo.senderEmail}) invited you to access credentials for{' '}
                <strong className="text-slate-800">{inviteInfo.serviceName}</strong>.
              </p>
            </div>

            {/* Details Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Shared Password:</span>
                <span className="font-semibold text-slate-800">{inviteInfo.serviceName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Access Level:</span>
                <span className="font-semibold text-indigo-700">
                  {inviteInfo.permission === 'edit' ? 'Can edit' : 'Can view & copy'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Invited Email:</span>
                <span className="font-mono text-slate-800">{inviteInfo.recipientEmail}</span>
              </div>
            </div>

            {/* Case 1: Recipient is not signed in */}
            {!currentUser && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    To access this shared password, sign in or create an account using{' '}
                    <strong>{inviteInfo.recipientEmail}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Sign in to accept</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Case 2: Signed in as someone else (Email Mismatch) */}
            {currentUser && !isEmailMatching && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Email mismatch:</strong> You are currently signed in as{' '}
                    <span className="font-semibold">{currentUser.email}</span>, but this invitation was sent to{' '}
                    <span className="font-semibold">{inviteInfo.recipientEmail}</span>.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Keep current account
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out & switch</span>
                  </button>
                </div>
              </div>
            )}

            {/* Case 3: Signed in with matching email - Ready to Accept */}
            {currentUser && isEmailMatching && (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Signed in as <strong>{currentUser.email}</strong>. Ready to accept.
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100/70 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>The password remains hidden until you choose to reveal or copy it.</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={handleAccept}
                    className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAccepting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Accepting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept invitation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, KeyRound, AlertCircle } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { unlockVault, currentUser } = useVault();
  const [passphrase, setPassphrase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setErrorMsg('Please enter your passphrase.');
      return;
    }

    const ok = unlockVault(passphrase);
    if (!ok) {
      setErrorMsg('Incorrect passphrase. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Brand Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-2xs">
          <Lock className="w-8 h-8 stroke-2" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Unlock your vault
          </h1>
          <p className="text-xs text-slate-500">
            Welcome back, {currentUser.name}. Enter your passphrase to access your passwords.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Vault passphrase
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoFocus
                placeholder="Enter passphrase (e.g. password123)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Unlock vault</span>
          </button>
        </form>
      </div>
    </div>
  );
};

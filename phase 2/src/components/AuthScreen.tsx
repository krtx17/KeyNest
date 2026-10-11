import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { KeyRound, Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { signIn, createAccount } = useVault();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter your password.');
        return;
      }

      setIsSubmitting(true);
      try {
        const ok = await createAccount(email.trim(), password);
        if (!ok) {
          setErrorMessage('Could not create account. If this email is already registered, try signing in.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not connect to the server. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        const ok = await signIn(email.trim(), password);
        if (!ok) {
          setErrorMessage('Invalid email or password. Please check your credentials and try again.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not connect to the server. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Brand Icon & Heading */}
        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
            <KeyRound className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Keynest</h1>
            <p className="text-xs text-slate-500 mt-1">
              Your private personal and shared credential vault
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                autoFocus
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Master Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                {mode === 'signup' ? 'Master password' : 'Password'}
              </label>
              {mode === 'signup' && (
                <span className="text-[10px] text-slate-400">Min. 8 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'signup' ? 'Create a master password' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign up only) */}
          {mode === 'signup' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Confirm master password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your master password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
            <span>
              {isSubmitting
                ? 'Processing...'
                : mode === 'signup'
                ? 'Create account & open vault'
                : 'Sign in to vault'}
            </span>
          </button>
        </form>

        {/* Honest Security Callout & Zero-Knowledge Recovery Notice */}
        <div className="pt-2 border-t border-slate-100 text-left space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-700">
            {mode === 'signin' ? 'Forgot your password?' : 'Vault security notice'}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            KeyNest is built so that passwords are never stored in plaintext. Because only you hold the keys, automatic password recovery is not supported. Please keep your master password safe.
          </p>
        </div>
      </div>
    </div>
  );
};

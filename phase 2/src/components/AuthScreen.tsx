import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Info,
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const {
    signIn,
    createAccount,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
    pendingResetToken,
    setPendingResetToken,
  } = useVault();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(() => {
    return pendingResetToken ? 'reset' : 'signin';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Reset token verification state
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [resetTokenValid, setResetTokenValid] = useState<boolean | null>(null);
  const [tokenEmail, setTokenEmail] = useState<string>('');

  useEffect(() => {
    if (pendingResetToken) {
      setMode('reset');
      setIsVerifyingToken(true);
      verifyResetToken(pendingResetToken)
        .then((res) => {
          if (res.isValid) {
            setResetTokenValid(true);
            if (res.email) setTokenEmail(res.email);
          } else {
            setResetTokenValid(false);
            setErrorMessage(res.error || 'This password reset link is invalid or has expired.');
          }
        })
        .finally(() => {
          setIsVerifyingToken(false);
        });
    }
  }, [pendingResetToken, verifyResetToken]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMessage('Please enter your email address.');
        return;
      }
      if (!validateEmail(email)) {
        setErrorMessage('Please enter a valid email address (e.g. name@example.com).');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await requestPasswordReset(email.trim());
        if (result.success) {
          setResetSentSuccess(true);
        } else {
          setErrorMessage(result.error || 'Could not send reset link. Please try again.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not connect to the server. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!password) {
        setErrorMessage('Please enter your new password.');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter your password.');
        return;
      }
      if (!pendingResetToken) {
        setErrorMessage('Reset token is missing. Please request a new password reset link.');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await resetPassword(pendingResetToken, password);
        if (result.success) {
          // Clear query parameter from URL
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setPendingResetToken(null);
          setPassword('');
          setConfirmPassword('');
          setSuccessMessage('Password reset successfully. All previous sessions have been signed out. Please sign in with your new password.');
          setMode('signin');
        } else {
          setErrorMessage(result.error || 'Could not reset password. Please request a new reset link.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not connect to the server. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
        const result = await createAccount(email.trim(), password);
        if (!result.success) {
          setErrorMessage(result.error || 'Could not create account. Please try again.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not connect to the server. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        const result = await signIn(email.trim(), password);
        if (!result.success) {
          setErrorMessage(result.error || 'Invalid email or password. Please check your credentials and try again.');
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

        {/* Mode Switcher (Visible in Sign in / Sign up modes) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage('');
                setSuccessMessage('');
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
                setSuccessMessage('');
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
        )}

        {/* Back Button for Forgot Password */}
        {mode === 'forgot' && (
          <div className="flex items-center justify-between text-left">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage('');
                setSuccessMessage('');
                setResetSentSuccess(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Password Reset
            </span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* VIEW 1: FORGOT PASSWORD (Link Sent Confirmation) */}
        {mode === 'forgot' && resetSentSuccess ? (
          <div className="space-y-5 text-left animate-in fade-in-50 duration-150">
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Check your inbox</span>
              </div>
              <p className="text-xs text-indigo-700 leading-relaxed">
                If an account exists for <strong className="font-semibold text-indigo-900">{email}</strong>, we have sent a secure, single-use password reset link.
              </p>
              <p className="text-[11px] text-indigo-600">
                The link expires in 30 minutes and can only be used once. Please check your spam folder if you do not see it shortly.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Vault Encryption Notice</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Resetting your sign-in password restores account access. If you enabled separate zero-knowledge encryption for your vault, your emergency recovery key or master passphrase is still required to decrypt saved logins.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setResetSentSuccess(false);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Return to sign in</span>
            </button>
          </div>
        ) : null}

        {/* VIEW 2: FORGOT PASSWORD (Request Form) */}
        {mode === 'forgot' && !resetSentSuccess ? (
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left animate-in fade-in-50 duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900">Forgot your password?</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your registered email address below. We'll send you a secure link to reset your sign-in password.
              </p>
            </div>

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

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold text-amber-900">Zero-Knowledge Notice:</p>
              <p className="leading-relaxed">
                This reset updates your app sign-in password. For zero-knowledge vaults, it does not recover encrypted vault secrets without your recovery key.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>{isSubmitting ? 'Sending link...' : 'Send reset link'}</span>
            </button>
          </form>
        ) : null}

        {/* VIEW 3: RESET PASSWORD (From email token link) */}
        {mode === 'reset' ? (
          <div className="space-y-4 text-left animate-in fade-in-50 duration-150">
            {isVerifyingToken ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Verifying secure reset link...</p>
              </div>
            ) : resetTokenValid === false ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Reset link expired or invalid</h3>
                  <p className="text-xs text-slate-500">
                    This password reset link is invalid or has already been used. Password reset links expire after 30 minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setPendingResetToken(null);
                    setErrorMessage('');
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
                >
                  Request a new reset link
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Set new password</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {tokenEmail ? (
                      <>Resetting sign-in password for <strong className="text-slate-800">{tokenEmail}</strong>.</>
                    ) : (
                      'Create a new sign-in password for your KeyNest account.'
                    )}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      New password
                    </label>
                    <span className="text-[10px] text-slate-400">Min. 8 characters</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      placeholder="Enter new password"
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

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-left">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Security & Sessions Notice</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Resetting will automatically sign out all existing devices. You will need to sign in again with your new password.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Updating password...' : 'Set new password & sign in'}</span>
                </button>
              </form>
            )}
          </div>
        ) : null}

        {/* VIEW 4: SIGN IN & SIGN UP FORM */}
        {(mode === 'signin' || mode === 'signup') && (
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
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

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  {mode === 'signup' ? 'Master password' : 'Password'}
                </label>
                {mode === 'signup' ? (
                  <span className="text-[10px] text-slate-400">Min. 8 characters</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                  >
                    Forgot password?
                  </button>
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
        )}

        {/* Security Callout & Zero-Knowledge Recovery Notice Footer */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="pt-2 border-t border-slate-100 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-700">
                {mode === 'signin' ? 'Forgot your password?' : 'Vault security notice'}
              </p>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
                >
                  Reset password
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {mode === 'signin'
                ? 'Send a secure reset link to your verified email. Resetting your sign-in password does not recover separate zero-knowledge vault passphrases without your recovery key.'
                : 'KeyNest is built so passwords are never stored in plaintext. Master passwords protect zero-knowledge vault items and require recovery keys if forgotten.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

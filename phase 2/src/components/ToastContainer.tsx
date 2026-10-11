import React, { useEffect, useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  X,
} from 'lucide-react';
import { ToastNotification } from '../types/vault';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useVault();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: ToastNotification;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const [secondsLeft, setSecondsLeft] = useState(toast.countdownRemaining || 30);

  useEffect(() => {
    if (toast.type === 'clipboard' && secondsLeft > 0) {
      const interval = setInterval(() => {
        setSecondsLeft((s: number) => (s <= 1 ? 0 : s - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [toast.type, secondsLeft]);

  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'clipboard':
        return <Copy className="w-4 h-4 text-indigo-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
  };

  return (
    <div className="pointer-events-auto bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-800 flex items-start justify-between gap-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-150 text-xs">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{renderIcon()}</div>
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-100">{toast.title}</p>
          {toast.message && (
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {toast.type === 'clipboard' && secondsLeft > 0
                ? `Copied. Clears in ${secondsLeft}s where supported.`
                : toast.message}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import { CheckCircle2, AlertCircle, Info, X, Printer } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  return (
    <div
      aria-live="polite"
      className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm z-50 flex flex-col gap-2 pointer-events-none pt-[env(safe-area-inset-top,0px)]"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.94, transition: { duration: 0.16 } }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-lg flex items-start gap-3 backdrop-blur-md transition-all ${
                isSuccess
                  ? 'bg-white/95 border-emerald-200 text-slate-900 shadow-emerald-500/10'
                  : isError
                  ? 'bg-white/95 border-red-200 text-slate-900 shadow-red-500/10'
                  : 'bg-white/95 border-blue-200 text-slate-900 shadow-blue-500/10'
              }`}
            >
              {/* Status Icon */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isSuccess
                    ? 'bg-emerald-100 text-emerald-600'
                    : isError
                    ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : isError ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Printer className="w-5 h-5 text-blue-600" />
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

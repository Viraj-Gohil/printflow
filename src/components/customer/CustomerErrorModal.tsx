import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, FileX2, FileWarning, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { DocumentValidationError } from '../../lib/validation/documentValidation';

interface CustomerErrorModalProps {
  error: DocumentValidationError | null;
  onClose: () => void;
  onChooseAnother?: () => void;
}

export const CustomerErrorModal: React.FC<CustomerErrorModalProps> = ({
  error,
  onClose,
  onChooseAnother
}) => {
  if (!error || !error.isOpen) return null;

  const isUnsupported = error.code === 'UNSUPPORTED_FORMAT';
  const isCorrupt = error.code === 'CORRUPT_DOCUMENT';
  const isOversized = error.code === 'FILE_TOO_LARGE';
  const isPrinterUnavailable = error.code === 'NO_COMPATIBLE_PRINTER';

  const getIcon = () => {
    if (isUnsupported) {
      return (
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-4">
          <FileX2 className="w-6 h-6 stroke-[2]" />
        </div>
      );
    }
    if (isCorrupt) {
      return (
        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 mb-4">
          <FileWarning className="w-6 h-6 stroke-[2]" />
        </div>
      );
    }
    if (isOversized) {
      return (
        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-4">
          <AlertCircle className="w-6 h-6 stroke-[2]" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700 mb-4">
        <AlertTriangle className="w-6 h-6 stroke-[2]" />
      </div>
    );
  };

  const handleAction = () => {
    onClose();
    if (onChooseAnother) {
      onChooseAnother();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E1E7E1] overflow-hidden font-['Manrope',sans-serif]"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-[#111111] hover:bg-[#F7F8F7] rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-7">
            {getIcon()}

            <h3 className="text-lg font-bold text-[#111111] tracking-tight">
              {error.title}
            </h3>

            <p className="mt-2 text-sm text-[#646B65] leading-relaxed">
              {error.message}
            </p>

            {/* Structured details card */}
            <div className="mt-4 p-3.5 bg-[#F7F8F7] rounded-xl border border-[#E1E7E1] space-y-2 text-xs">
              {error.fileName && (
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#646B65]">Selected file:</span>
                  <span className="font-medium text-[#111111] text-right truncate max-w-[220px]" title={error.fileName}>
                    {error.fileName}
                  </span>
                </div>
              )}

              {error.detectedType && (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#646B65]">Detected format:</span>
                  <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                    {error.detectedType}
                  </span>
                </div>
              )}

              {error.supportedFormats && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E1E7E1]">
                  <span className="font-semibold text-[#646B65]">Supported formats:</span>
                  <span className="font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded border border-[#A7F3D0]">
                    {error.supportedFormats}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-[#646B65] hover:bg-[#F7F8F7] rounded-xl transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleAction}
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#00B32D] hover:bg-[#008F25] active:scale-[0.98] rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>{error.actionText || 'Choose Another File'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

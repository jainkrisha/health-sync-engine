import React from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    info: 'bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all">
        <div className="p-6">
          <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

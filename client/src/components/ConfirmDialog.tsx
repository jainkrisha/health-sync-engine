import React, { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

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

const VARIANTS: Record<NonNullable<ConfirmDialogProps['variant']>, { button: string; icon: IconName; iconTone: string }> = {
  danger: { button: 'btn-danger', icon: 'trash', iconTone: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-900/50' },
  warning: { button: 'btn bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500', icon: 'alert', iconTone: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-900/50' },
  info: { button: 'btn-primary', icon: 'info', iconTone: 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-900/50' },
};

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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; read the latest one without re-running the effect.
  const cancelHandler = useRef(onCancel);
  useEffect(() => {
    cancelHandler.current = onCancel;
  });

  // Focus the safe choice, close on Escape, keep Tab inside the dialog, and lock page scroll.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelHandler.current();
      } else if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const v = VARIANTS[variant];

  return (
    <div className="fixed inset-0 z-overlay flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 animate-overlay-in bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex gap-4 p-6">
          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-4 ${v.iconTone}`}>
            <Icon name={v.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p id="confirm-dialog-message" className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-800/40">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={v.button}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

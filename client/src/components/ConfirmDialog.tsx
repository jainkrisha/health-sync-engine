import React, { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';
import { useI18n } from '../i18n/useI18n';

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
  danger: { button: 'btn-danger', icon: 'trash', iconTone: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  warning: { button: 'btn-primary', icon: 'alert', iconTone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  info: { button: 'btn-primary', icon: 'info', iconTone: 'bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200' },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  const { t } = useI18n();
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
      <div className="absolute inset-0 bg-slate-950/60" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-300 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex gap-4 p-6">
          <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${v.iconTone}`}>
            <Icon name={v.icon} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p id="confirm-dialog-message" className="mt-2 text-base text-slate-700 dark:text-slate-300">
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-800/60">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-plain">
            {cancelText ?? t('Cancel')}
          </button>
          <button type="button" onClick={onConfirm} className={v.button}>
            {confirmText ?? t('Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

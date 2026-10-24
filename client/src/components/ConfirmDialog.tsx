import { useEffect, useRef } from 'react';
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

/**
 * A question that needs an answer before going on. The safe choice has focus;
 * Escape and the backdrop cancel; Tab stays inside the dialog.
 */
export function ConfirmDialog({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, variant = 'warning' }: ConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; read the latest one without re-running the effect.
  const cancelHandler = useRef(onCancel);
  useEffect(() => {
    cancelHandler.current = onCancel;
  });

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

  return (
    <div className="fixed inset-0 z-overlay flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-[#0b0c0c]/70" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className={`relative w-full max-w-lg border-t-[6px] bg-paper p-6 sm:p-8 ${variant === 'danger' ? 'border-alert' : 'border-band'}`}
      >
        <h2 id="confirm-dialog-title" className="heading-l">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-3">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onConfirm} className={variant === 'danger' ? 'btn-warning' : 'btn-primary'}>
            {confirmText ?? t('Confirm')}
          </button>
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
            {cancelText ?? t('Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

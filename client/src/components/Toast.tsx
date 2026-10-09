/**
 * Toast.tsx — Lightweight toast notification system.
 * OWNERSHIP: Person B (shared component — Person C may reuse for their flows).
 *
 * Usage:
 *   1. Wrap your app (or layout) with <ToastProvider>
 *   2. Call useToast().toast({ message, type }) anywhere inside it
 *
 * No network calls. No external dependencies beyond React.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { Icon, type IconName } from './Icon'
import { useI18n } from '../i18n/useI18n'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (opts: { message: string; type?: ToastType }) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const { t: translate } = useI18n()
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    ({ message, type = 'success' }: { message: string; type?: ToastType }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts(prev => [...prev, { id, message, type }])

      // Auto-dismiss after 4 s
      const timer = setTimeout(() => dismiss(id), 4000)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  // Clear all timers on unmount
  useEffect(() => {
    const map = timers.current
    return () => map.forEach(t => clearTimeout(t))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack — bottom centre on phones (above the tab bar), bottom-right on larger screens */}
      <div
        aria-live="polite"
        aria-label={translate('Notifications')}
        className="pointer-events-none fixed inset-x-4 bottom-20 z-toast flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Individual toast bubble ──────────────────────────────────────────────────

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const styles: Record<ToastType, { bar: string; icon: string; name: IconName }> = {
    success: { bar: 'bg-sage-500', icon: 'text-sage-600 dark:text-sage-400', name: 'checkCircle' },
    error: { bar: 'bg-rose-500', icon: 'text-rose-600 dark:text-rose-400', name: 'xCircle' },
    warning: { bar: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400', name: 'alert' },
    info: { bar: 'bg-medical-500', icon: 'text-medical-600 dark:text-medical-400', name: 'info' },
  }
  const s = styles[item.type]
  const { t: translate } = useI18n()

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto relative flex w-full max-w-sm animate-slide-up items-start gap-3 overflow-hidden rounded-xl border border-slate-200
                 bg-white py-3 pl-4 pr-2 text-sm text-slate-800 shadow-pop sm:min-w-[280px]
                 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} aria-hidden="true" />
      <Icon name={s.name} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`} />
      <span className="flex-1 py-0.5 font-medium leading-5">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label={translate('Dismiss notification')}
        className="btn-icon -my-1 h-8 w-8 flex-shrink-0"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}

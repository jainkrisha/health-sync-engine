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

      // Auto-dismiss after 7 s: long enough to read slowly.
      const timer = setTimeout(() => dismiss(id), 7000)
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
      {/* Messages: bottom of the screen on phones, bottom-right on larger screens */}
      <div
        aria-live="polite"
        aria-label={translate('Notifications')}
        className="pointer-events-none fixed inset-x-4 bottom-4 z-toast flex flex-col items-center gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
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
  const edge: Record<ToastType, string> = {
    success: 'border-ok',
    error: 'border-alert',
    warning: 'border-warn',
    info: 'border-band',
  }
  const { t: translate } = useI18n()

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-md items-start gap-4 border-[3px] border-t-[8px] bg-paper px-4 py-3 text-base text-ink shadow-[0_4px_0_rgb(11_12_12/0.25)] sm:min-w-[340px] ${edge[item.type]}`}
    >
      <span className="flex-1 font-bold">{item.message}</span>
      <button onClick={() => onDismiss(item.id)} className="btn-text text-sm" aria-label={translate('Dismiss notification')}>
        {translate('Close')}
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

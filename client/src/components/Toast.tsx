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
      {/* Toast stack — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
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
  const styles: Record<ToastType, string> = {
    success: 'bg-teal-600 text-white',
    error:   'bg-status-danger text-white',
    warning: 'bg-status-warning text-white',
    info:    'bg-medical-600 text-white',
  }

  const icons: Record<ToastType, string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'i',
  }

  return (
    <div
      role="status"
      className={`
        pointer-events-auto flex items-center gap-3 min-w-[240px] max-w-sm
        rounded-lg px-4 py-3 shadow-card-lg text-sm font-medium
        animate-[slideUp_0.2s_ease-out]
        ${styles[item.type]}
      `}
    >
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center
                   rounded-full bg-white/20 text-xs font-bold"
      >
        {icons[item.type]}
      </span>
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="ml-auto flex-shrink-0 rounded p-0.5 opacity-70 hover:opacity-100
                   hover:bg-white/20 transition-opacity"
      >
        ✕
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

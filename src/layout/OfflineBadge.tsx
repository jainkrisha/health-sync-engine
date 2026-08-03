/**
 * OfflineBadge — shows the current online/offline state.
 * OWNERSHIP: Person A (layout/).
 *
 * Offline is NOT an error state in this app. This is a neutral indicator.
 * Never show a red error style here — use a neutral grey for offline.
 */

import { useEffect, useState } from 'react'

export function OfflineBadge() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-1.5 rounded-badge px-2.5 py-1 text-xs font-medium w-full',
        isOnline
          ? 'bg-teal-900 text-teal-300'
          : 'bg-slate-700 text-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          isOnline ? 'bg-teal-400 animate-pulse' : 'bg-slate-400',
        ].join(' ')}
      />
      {isOnline ? 'Online' : 'Offline'}
    </div>
  )
}

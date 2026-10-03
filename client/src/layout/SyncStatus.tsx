/**
 * SyncStatus — header controls for synchronisation: connection state, pending
 * count, last sync time, "Sync now", and the demo "simulate offline" switch.
 */
import { useSyncEngine } from '../hooks/useSync';
import { Icon } from '../components/Icon';
import { Spinner, relativeTime } from '../components/ui';

const LABELS = {
  offline: 'Offline',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  idle: 'Synced',
  error: 'Server unreachable',
  signed_out: 'Signed out',
} as const;

export function SyncStatus() {
  const sync = useSyncEngine();
  const offline = sync.status === 'offline' || sync.status === 'error' || sync.status === 'connecting';
  const hasPending = sync.pendingCount > 0;

  const tone =
    sync.status === 'idle' && !hasPending
      ? 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900'
      : sync.status === 'error'
        ? 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900'
        : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${tone}`}
        title={sync.lastError ?? `Last synced ${relativeTime(sync.lastSyncedAt)}`}
      >
        {sync.status === 'syncing' || sync.status === 'connecting' ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <Icon name={offline ? 'wifiOff' : 'wifi'} className="h-3.5 w-3.5" />
        )}
        <span>{LABELS[sync.status]}</span>
        {hasPending && (
          <span className="rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-bold text-white">
            {sync.pendingCount} pending
          </span>
        )}
        <span className="hidden text-[11px] opacity-70 md:inline">· {relativeTime(sync.lastSyncedAt)}</span>
      </div>

      <button
        type="button"
        className="btn-secondary px-3 py-1.5 text-xs"
        onClick={() => void sync.triggerSync()}
        disabled={!sync.connected || sync.status === 'syncing'}
      >
        <Icon name="sync" className="h-3.5 w-3.5" />
        Sync now
      </button>

      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            aria-label="Simulate offline"
            checked={sync.simulatedOffline}
            onChange={(e) => sync.setSimulatedOffline(e.target.checked)}
          />
          <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-amber-500 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 dark:bg-slate-600" />
          <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </span>
        <span className="hidden sm:inline">Simulate offline</span>
      </label>
    </div>
  );
}

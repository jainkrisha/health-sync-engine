/**
 * SyncStatus — one line under the menu that says, in plain words, whether
 * work is on the server or only on this device. Quiet when all is well; a
 * yellow strip when work is waiting, so it is noticed without alarming.
 * Also holds "Sync now" and the demo's "Simulate offline" switch.
 */
import { useSyncEngine } from '../hooks/useSync';
import { Spinner, relativeTime } from '../components/ui';
import { useI18n } from '../i18n/useI18n';

export function SyncStatus() {
  const sync = useSyncEngine();
  const { t, tp } = useI18n();
  const pending = sync.pendingCount;

  // With no network at all, "offline" says more than "cannot reach the server".
  const status = sync.status === 'error' && !navigator.onLine ? 'offline' : sync.status;
  let tone: 'quiet' | 'busy' | 'waiting';
  let title: string;
  let detail: string;
  switch (status) {
    case 'syncing':
      tone = 'busy';
      title = t('Sending and receiving updates…');
      detail = t('Please keep the app open for a moment.');
      break;
    case 'connecting':
      tone = 'busy';
      title = t('Connecting to the server…');
      detail = t('You can keep working. Your changes are saved on this device.');
      break;
    case 'offline':
      tone = 'waiting';
      title = t('Offline');
      detail = pending
        ? tp(pending, '{count} change is saved on this device and will be sent when the internet is back.', '{count} changes are saved on this device and will be sent when the internet is back.')
        : t('You can keep working. Changes are saved on this device and sent when the internet is back.');
      break;
    case 'error':
      tone = 'waiting';
      title = t('Cannot reach the server');
      detail = t('Your changes are safe on this device. The app will keep trying.');
      break;
    default:
      if (pending) {
        tone = 'busy';
        title = tp(pending, '{count} change not sent yet', '{count} changes not sent yet');
        detail = t('They will be sent in a moment.');
      } else {
        tone = 'quiet';
        title = t('Online');
        detail = t('All changes are saved on the server. Last update {when}.', { when: relativeTime(sync.lastSyncedAt) });
      }
  }

  return (
    <div className={tone === 'waiting' ? 'bg-warn-soft' : 'border-b border-rule'}>
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-base sm:px-6">
        <div role="status" aria-live="polite" className="flex min-w-0 basis-full items-baseline gap-2 md:flex-1 md:basis-auto">
          {tone === 'busy' ? (
            <Spinner className="h-3.5 w-3.5 flex-shrink-0 self-center" />
          ) : (
            <span className={`inline-block h-3 w-3 flex-shrink-0 self-center ${tone === 'quiet' ? 'bg-ok' : 'bg-warn'}`} aria-hidden="true" />
          )}
          <p className="min-w-0">
            <strong className={tone === 'waiting' ? 'text-warn' : undefined}>{title}</strong>{' '}
            <span className="text-muted max-sm:hidden">{detail}</span>
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <button
            type="button"
            className="btn-text"
            onClick={() => void sync.triggerSync()}
            disabled={!sync.connected || sync.status === 'syncing'}
            title={t('Send changes from this device and get the latest records now')}
          >
            {t('Sync now')}
          </button>
          <label className="flex cursor-pointer select-none items-center gap-2" title={t('For demonstrations: cut this device off from the server to show offline work')}>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[rgb(var(--ink))]"
              aria-label={t('Simulate offline')}
              checked={sync.simulatedOffline}
              onChange={(e) => sync.setSimulatedOffline(e.target.checked)}
            />
            {t('Simulate offline')}
          </label>
        </div>
      </div>
    </div>
  );
}

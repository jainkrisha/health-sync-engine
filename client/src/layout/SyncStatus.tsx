/**
 * SyncStatus — the strip under the top bar that says, in plain words, whether
 * work is saved on the server or only on this device, and what happens next.
 * It also holds "Send now" and the demo's "Simulate offline" switch.
 */
import { useSyncEngine } from '../hooks/useSync';
import { Icon, type IconName } from '../components/Icon';
import { Spinner, relativeTime } from '../components/ui';
import { useI18n } from '../i18n/useI18n';

type Tone = 'ok' | 'busy' | 'warning';

const TONE: Record<Tone, string> = {
  ok: 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100',
  busy: 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100',
  warning: 'bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
};

export function SyncStatus() {
  const sync = useSyncEngine();
  const { t, tp } = useI18n();
  const pending = sync.pendingCount;

  let tone: Tone;
  let icon: IconName | 'spinner';
  let title: string;
  let detail: string;
  // With no network at all, "offline" says more than "cannot reach the server".
  const status = sync.status === 'error' && !navigator.onLine ? 'offline' : sync.status;
  switch (status) {
    case 'syncing':
      tone = 'busy';
      icon = 'spinner';
      title = t('Sending and receiving updates…');
      detail = t('Please keep the app open for a moment.');
      break;
    case 'connecting':
      tone = 'busy';
      icon = 'spinner';
      title = t('Connecting to the server…');
      detail = t('You can keep working. Your changes are saved on this device.');
      break;
    case 'offline':
      tone = 'warning';
      icon = 'wifiOff';
      title = t('Offline');
      detail = pending
        ? tp(pending, '{count} change is saved on this device and will be sent when the internet is back.', '{count} changes are saved on this device and will be sent when the internet is back.')
        : t('You can keep working. Changes are saved on this device and sent when the internet is back.');
      break;
    case 'error':
      tone = 'warning';
      icon = 'alert';
      title = t('Cannot reach the server');
      detail = t('Your changes are safe on this device. The app will keep trying.');
      break;
    default:
      if (pending) {
        tone = 'busy';
        icon = 'clock';
        title = tp(pending, '{count} change not sent yet', '{count} changes not sent yet');
        detail = t('They will be sent in a moment.');
      } else {
        tone = 'ok';
        icon = 'checkCircle';
        title = t('Online');
        detail = t('All changes are saved on the server. Last update {when}.', { when: relativeTime(sync.lastSyncedAt) });
      }
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10 ${TONE[tone]}`}>
      <div role="status" aria-live="polite" className="flex min-w-0 basis-full items-start gap-2.5 md:flex-1 md:basis-auto">
        {icon === 'spinner' ? <Spinner className="mt-0.5 h-5 w-5 flex-shrink-0" /> : <Icon name={icon} className="mt-0.5 h-5 w-5 flex-shrink-0" />}
        <p className="min-w-0 text-base">
          <strong className="font-bold">{title}</strong> <span className="hidden sm:inline">{detail}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-plain btn-sm"
          onClick={() => void sync.triggerSync()}
          disabled={!sync.connected || sync.status === 'syncing'}
          title={t('Send changes from this device and get the latest records now')}
        >
          <Icon name="sync" className="h-5 w-5" />
          {t('Sync now')}
        </button>
        <label className="inline-flex min-h-[2.5rem] cursor-pointer select-none items-center gap-2 rounded-lg px-1 text-sm font-semibold" title={t('For demonstrations: cut this device off from the server to show offline work')}>
          <input
            type="checkbox"
            className="h-5 w-5 accent-amber-600"
            aria-label={t('Simulate offline')}
            checked={sync.simulatedOffline}
            onChange={(e) => sync.setSimulatedOffline(e.target.checked)}
          />
          {t('Simulate offline')}
        </label>
      </div>
    </div>
  );
}

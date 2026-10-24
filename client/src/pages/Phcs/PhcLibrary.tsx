/**
 * Health centres (district only): one card per Primary Health Centre with its
 * patients, staff, tablets, activity this week and doses waiting for review.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_LABELS, type PhcSummary } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorNotice, OfflineNotice, PageHeader, SkeletonRows, formatDate, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

function Number({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Centre({ phc }: { phc: PhcSummary }) {
  const { t, tp } = useI18n();
  const [open, setOpen] = useState(false);
  const online = phc.devices.filter((d) => d.online).length;
  const id = `phc-${phc.name.replace(/\W+/g, '-')}`;

  return (
    <li>
      <article className="card space-y-5" aria-labelledby={`${id}-h`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`${id}-h`} className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Icon name="clinic" className="h-6 w-6 text-brand-700 dark:text-brand-300" /> {tFacility(phc.name)}
            </h2>
            <p className="mt-1 text-base text-slate-700 dark:text-slate-300">
              {phc.lastSyncAt ? t('Last update {when}', { when: relativeTime(phc.lastSyncAt) }) : t('No updates received yet')}
              {phc.since && ` · ${t('Using HealthSync since {date}', { date: formatDate(phc.since) })}`}
            </p>
          </div>
          {phc.openConflicts.length > 0 ? (
            <span className="badge-warning text-base">
              <Icon name="alert" className="h-5 w-5" /> {tp(phc.openConflicts.length, '{count} dose waiting for review', '{count} doses waiting for review')}
            </span>
          ) : (
            <span className="badge-ok text-base">
              <Icon name="checkCircle" className="h-5 w-5" /> {t('No doses waiting')}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Number value={phc.patientCount} label={t('Patients registered')} />
          <Number value={phc.staff.length} label={t('Staff')} />
          <Number value={`${online} / ${phc.devices.length}`} label={t('Tablets online')} />
          <Number value={phc.syncedThisWeek} label={t('Changes this week')} />
        </dl>

        <button type="button" className="btn-plain btn-sm" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpen((o) => !o)}>
          <Icon name="chevronDown" className={`h-5 w-5 ${open ? 'rotate-180' : ''}`} />
          {open ? t('Hide details') : t('Show staff, tablets and recent patients')}
        </button>

        {open && (
          <div id={`${id}-more`} className="grid gap-6 lg:grid-cols-3">
            <section>
              <h3 className="mb-2 text-lg font-bold">{t('Staff')}</h3>
              {phc.staff.length ? (
                <ul className="space-y-2">
                  {phc.staff.map((s) => (
                    <li key={s.username}>
                      <span className="block font-semibold">{tName(s.name)}</span>
                      <span className="block text-sm text-slate-700 dark:text-slate-300">{t(ROLE_LABELS[s.role])}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No staff accounts yet.')}</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-lg font-bold">{t('Tablets')}</h3>
              {phc.devices.length ? (
                <ul className="space-y-2">
                  {phc.devices.map((d) => (
                    <li key={d.clientId}>
                      <span className="block font-semibold">{tName(d.deviceName)}</span>
                      <span className={d.online ? 'badge-ok' : 'badge-muted'}>
                        <Icon name={d.online ? 'wifi' : 'wifiOff'} className="h-4 w-4" />
                        {d.online ? t('Online') : t('Offline')} · {relativeTime(d.lastSyncAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No tablets have connected yet.')}</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-lg font-bold">{t('Recently registered patients')}</h3>
              {phc.recentPatients.length ? (
                <ul className="space-y-2">
                  {phc.recentPatients.map((p) => (
                    <li key={p.id}>
                      <Link to={`/patients/${p.id}`} className="link">
                        {tName(p.name)}
                      </Link>
                      {p.needsReview && (
                        <span className="badge-warning ml-2">
                          <Icon name="alert" className="h-4 w-4" /> {t('Dose review')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No patients yet.')}</p>
              )}
            </section>
          </div>
        )}
      </article>
    </li>
  );
}

export default function PhcLibrary() {
  const { connected } = useSyncEngine();
  const { data, loading, error, reload } = useApi<{ phcs: PhcSummary[] }>(connected ? '/phcs' : null, connected);
  const { t } = useI18n();
  const phcs = data?.phcs ?? [];

  return (
    <div>
      <PageHeader title={t('Health centres')} subtitle={t('Every Primary Health Centre in the district, with its patients, staff and tablets.')} />
      {!connected ? (
        <OfflineNotice message={t('Connect to the internet to see the health centres.')} />
      ) : loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load the health centres:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : phcs.length === 0 ? (
        <div className="card">
          <EmptyState icon="clinic" title={t('No health centres yet')} message={t('A health centre appears here when its first staff account is created.')} />
        </div>
      ) : (
        <ul className="space-y-5">
          {phcs.map((p) => (
            <Centre key={p.name} phc={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

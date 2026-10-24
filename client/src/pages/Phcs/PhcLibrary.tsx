/**
 * Health centres (district only): one section per Primary Health Centre, its
 * numbers as a summary list, with staff, tablets and recent patients behind
 * "Show details".
 */
import { Link } from 'react-router-dom';
import { ROLE_LABELS, type PhcSummary } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { ErrorNotice, Loading, OfflineNotice, PageHeader, formatDate, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

function Centre({ phc }: { phc: PhcSummary }) {
  const { t, tp } = useI18n();
  const online = phc.devices.filter((d) => d.online).length;
  const id = `phc-${phc.name.replace(/\W+/g, '-')}`;

  return (
    <li className="section">
      <article aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`} className="heading-l">
          {tFacility(phc.name)}
        </h2>
        <p className="mt-1 text-muted">
          {phc.lastSyncAt ? t('Last update {when}', { when: relativeTime(phc.lastSyncAt) }) : t('No updates received yet')}
          {phc.since && ` · ${t('Using HealthSync since {date}', { date: formatDate(phc.since) })}`}
        </p>
        {phc.openConflicts.length > 0 ? (
          <p className="status-warn mt-3">{tp(phc.openConflicts.length, '{count} dose waiting for review', '{count} doses waiting for review')}</p>
        ) : (
          <p className="status-ok mt-3">{t('No doses waiting')}</p>
        )}

        <dl className="mt-4 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
          {(
            [
              ['Patients registered', phc.patientCount],
              ['Staff', phc.staff.length],
              ['Tablets online', `${online} ${t('of')} ${phc.devices.length}`],
              ['Changes this week', phc.syncedThisWeek],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="py-3 pr-4 sm:border-r sm:border-rule sm:pl-4 sm:first:pl-0 sm:last:border-0">
              <dt className="text-sm text-muted">{t(label)}</dt>
              <dd className="text-2xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <details className="details mt-5">
          <summary>{t('Show staff, tablets and recent patients')}</summary>
          <div className="details-body grid gap-8 lg:grid-cols-3">
            <section>
              <h3 className="heading-s mb-2">{t('Staff')}</h3>
              {phc.staff.length ? (
                <ul className="space-y-2">
                  {phc.staff.map((s) => (
                    <li key={s.username}>
                      {tName(s.name)}
                      <span className="block text-sm text-muted">{t(ROLE_LABELS[s.role])}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No staff accounts yet.')}</p>
              )}
            </section>
            <section>
              <h3 className="heading-s mb-2">{t('Tablets')}</h3>
              {phc.devices.length ? (
                <ul className="space-y-2">
                  {phc.devices.map((d) => (
                    <li key={d.clientId}>
                      {tName(d.deviceName)}
                      <span className="block text-sm">
                        <span className={d.online ? 'status-ok' : 'status-muted'}>{d.online ? t('Online') : t('Offline')}</span>{' '}
                        <span className="text-muted">· {relativeTime(d.lastSyncAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No tablets have connected yet.')}</p>
              )}
            </section>
            <section>
              <h3 className="heading-s mb-2">{t('Recently registered patients')}</h3>
              {phc.recentPatients.length ? (
                <ul className="space-y-2">
                  {phc.recentPatients.map((p) => (
                    <li key={p.id}>
                      <Link to={`/patients/${p.id}`} className="link">
                        {tName(p.name)}
                      </Link>
                      {p.needsReview && <span className="status-warn flex w-fit text-sm">{t('Dose review')}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No patients yet.')}</p>
              )}
            </section>
          </div>
        </details>
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
      <PageHeader caption={t('District hospital')} title={t('Health centres')} lead={t('Every Primary Health Centre in the district, with its patients, staff and tablets.')} />
      {!connected ? (
        <OfflineNotice message={t('Connect to the internet to see the health centres.')} />
      ) : loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load the health centres:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : phcs.length === 0 ? (
        <div>
          <h2 className="heading-m">{t('No health centres yet')}</h2>
          <p className="mt-2">{t('A health centre appears here when its first staff account is created.')}</p>
        </div>
      ) : (
        <ul className="space-y-12">
          {phcs.map((p) => (
            <Centre key={p.name} phc={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

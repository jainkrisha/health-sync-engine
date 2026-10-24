/**
 * Home — what to do next, then the numbers that matter: patients, changes not
 * sent yet, doses waiting for a doctor, and (at the district hospital) how each
 * health centre is doing.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { portalForRole, type PhcSummary, type StatsResponse } from '@shared/types';
import { usePatients } from '../../hooks/usePatients';
import { useSyncEngine } from '../../hooks/useSync';
import { useApi } from '../../hooks/useApi';
import { usePermissions } from '../../context/RBAC';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getOutboxSince, type OutboxSummary } from '../../db/mutationLog';
import { onDataChanged } from '../../lib/events';
import { StatCard } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Avatar, EmptyState, Loading, PageHeader, SectionHeading, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { t as translate, tFacility } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

// Day keys use the device's local calendar date. (toISOString() would shift them
// to UTC, putting today's changes under yesterday east of Greenwich, e.g. in IST.)
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

// "Dr. Priya (PHC Wagholi)" -> "Dr. Priya"; "Admin User" -> "Admin".
function greetingName(name: string | undefined): string {
  const words = (name ?? '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return translate('there');
  return /^(dr|mr|mrs|ms)\.?$/i.test(words[0]) && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

function useOutboxWeek() {
  const [rows, setRows] = useState<OutboxSummary[]>([]);
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const load = () => void getOutboxSince(since).then(setRows).catch(() => undefined);
    load();
    return onDataChanged(load);
  }, []);
  return rows;
}

function FindPatient() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : '/patients');
  };
  return (
    <form onSubmit={submit} role="search" className="card">
      <label htmlFor="home-search" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
        <Icon name="search" className="h-6 w-6 text-brand-700 dark:text-brand-300" /> {t('Find a patient')}
      </label>
      <p className="form-help mb-3">{t('Type a name, phone number, allergy or medicine.')}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input id="home-search" type="search" className="form-input" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn-primary flex-shrink-0">
          <Icon name="search" className="h-5 w-5" /> {t('Search')}
        </button>
      </div>
    </form>
  );
}

function WeekChart() {
  const outbox = useOutboxWeek();
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const data = useMemo(() => {
    const map = new Map(last7Days().map((d) => [d, { day: d, synced: 0, pending: 0, conflicts: 0 }]));
    for (const r of outbox) {
      if (r.status === 'pending') {
        const e = map.get(dayKey(new Date(r.createdAt)));
        if (e) e.pending++;
      } else if (r.syncedAt) {
        const e = map.get(dayKey(new Date(r.syncedAt)));
        if (!e) continue;
        if (r.status === 'conflict') e.conflicts++;
        else if (r.status === 'synced' || r.status === 'resolved') e.synced++;
      }
    }
    return [...map.values()].map((d) => ({ ...d, label: new Date(`${d.day}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' }) }));
  }, [outbox, locale]);
  const dark = theme === 'dark';
  const axis = dark ? '#cbd5e1' : '#334155';
  const grid = dark ? '#334155' : '#e2e8f0';
  const total = data.reduce((n, d) => n + d.synced + d.pending + d.conflicts, 0);

  return (
    <section className="card" aria-labelledby="chart-h">
      <SectionHeading id="chart-h" icon="activity">
        {t('Changes from this device in the last 7 days')}
      </SectionHeading>
      {total === 0 ? (
        <p className="text-base text-slate-700 dark:text-slate-300">{t('No changes made on this device in the last 7 days.')}</p>
      ) : (
        <div
          className="h-64"
          role="img"
          aria-label={`${t('Bar chart of changes by day.')} ${data
            .map((d) => t('{day}: {synced} sent, {pending} not sent yet, {conflicts} sent for dose review', { day: d.label, synced: d.synced, pending: d.pending, conflicts: d.conflicts }))
            .join('; ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" stroke={axis} fontSize={14} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke={axis} fontSize={14} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: dark ? '#0f172a' : '#ffffff', border: `1px solid ${grid}`, borderRadius: 8, fontSize: 14 }}
                cursor={{ fill: dark ? '#1e293b' : '#f1f5f9' }}
              />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="synced" name={t('Sent')} stackId="a" fill={dark ? '#86acdb' : '#1f5fa6'} />
              <Bar dataKey="conflicts" name={t('Sent for dose review')} stackId="a" fill={dark ? '#fbbf24' : '#b45309'} />
              <Bar dataKey="pending" name={t('Not sent yet')} stackId="a" fill={dark ? '#94a3b8' : '#64748b'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CentresTable() {
  const { connected } = useSyncEngine();
  const { t } = useI18n();
  const phcs = useApi<{ phcs: PhcSummary[] }>(connected ? '/phcs' : null, connected);
  return (
    <section className="card p-0 sm:p-0" aria-labelledby="centres-h">
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <SectionHeading
          id="centres-h"
          icon="clinic"
          aside={
            <Link to="/phcs" className="link">
              {t('See all health centres')}
            </Link>
          }
        >
          {t('Health centres')}
        </SectionHeading>
      </div>
      {!connected ? (
        <p className="px-5 pb-5 text-base sm:px-6">{t('Connect to the internet to see the health centres.')}</p>
      ) : !phcs.data ? (
        <div className="px-5 sm:px-6">
          <Loading />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                {['Health centre', 'Patients', 'Devices online', 'Doses waiting', 'Last update'].map((h) => (
                  <th key={h} scope="col" className="table-head first:pl-5 sm:first:pl-6">
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {phcs.data.phcs.map((p) => (
                <tr key={p.name}>
                  <th scope="row" className="table-cell pl-5 text-left font-bold sm:pl-6">{tFacility(p.name)}</th>
                  <td className="table-cell tabular-nums">{p.patientCount}</td>
                  <td className="table-cell tabular-nums">
                    {p.devices.filter((d) => d.online).length} / {p.devices.length}
                  </td>
                  <td className="table-cell">
                    {p.openConflicts.length ? (
                      <span className="badge-warning">
                        <Icon name="alert" className="h-4 w-4" /> {p.openConflicts.length}
                      </span>
                    ) : (
                      <span className="badge-ok">
                        <Icon name="check" className="h-4 w-4" /> {t('None')}
                      </span>
                    )}
                  </td>
                  <td className="table-cell whitespace-nowrap">{relativeTime(p.lastSyncAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { patients, loading } = usePatients();
  const sync = useSyncEngine();
  const { user } = useAuth();
  const perms = usePermissions();
  const { t, tp } = useI18n();
  const district = Boolean(user && portalForRole(user.role) === 'district');
  const stats = useApi<StatsResponse>(sync.connected ? '/stats' : null, sync.lastSyncedAt);
  const openReviews = patients.filter((p) => p.hasOpenConflicts).length;

  const autoRate = stats.data
    ? (() => {
        const { automatic, manual } = stats.data.resolutions;
        const total = automatic + manual + stats.data.conflicts.pending;
        return total === 0 ? null : Math.round((automatic / total) * 100);
      })()
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('Hello, {name}', { name: tName(greetingName(user?.name)) })}
        subtitle={user ? `${tFacility(user.facility)} · ${t('What would you like to do today?')}` : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {perms.canEditPatients ? (
          <Link to="/patients/new" className="card group flex items-center gap-4 border-2 border-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:hover:bg-brand-950">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white dark:bg-brand-400 dark:text-slate-950">
              <Icon name="plus" className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-lg font-bold text-slate-900 group-hover:underline dark:text-white">{t('Add a new patient')}</span>
              <span className="block text-base text-slate-700 dark:text-slate-300">{t('Register someone seen today.')}</span>
            </span>
          </Link>
        ) : (
          perms.canReviewConflicts && (
            <Link to="/conflicts" className="card group flex items-center gap-4 border-2 border-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:hover:bg-brand-950">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white dark:bg-brand-400 dark:text-slate-950">
                <Icon name="pill" className="h-7 w-7" />
              </span>
              <span>
                <span className="block text-lg font-bold text-slate-900 group-hover:underline dark:text-white">{t('Review medicine doses')}</span>
                <span className="block text-base text-slate-700 dark:text-slate-300">{t('Choose the correct dose where two devices disagree.')}</span>
              </span>
            </Link>
          )
        )}
        <FindPatient />
      </div>

      {sync.pendingCount > 0 && (
        <div className="notice-warning">
          <Icon name="clock" className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>
            {tp(
              sync.pendingCount,
              '{count} change is saved only on this device. It will be sent to the server when there is internet.',
              '{count} changes are saved only on this device. They will be sent to the server when there is internet.',
            )}
          </p>
        </div>
      )}
      {openReviews > 0 && (
        <div className="notice-info">
          <Icon name="pill" className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="flex-1">
            {tp(
              openReviews,
              '{count} patient has a medicine dose waiting for a doctor to check it. Until then the earlier dose stays on the record.',
              '{count} patients have a medicine dose waiting for a doctor to check it. Until then the earlier dose stays on the record.',
            )}
          </p>
          {perms.canReviewConflicts && (
            <Link to="/conflicts" className="link whitespace-nowrap">
              {t('Review now')}
            </Link>
          )}
        </div>
      )}

      <section aria-labelledby="numbers-h">
        <h2 id="numbers-h" className="section-title mb-4">
          {t('At a glance')}
        </h2>
        {loading ? (
          <Loading />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="patients"
              label={district ? t('Patients on this computer') : t('Patients on this device')}
              value={patients.length}
              to="/patients"
              action={t('See patients')}
            />
            <StatCard
              icon="clock"
              label={t('Changes not sent yet')}
              value={sync.pendingCount}
              tone={sync.pendingCount ? 'warning' : 'ok'}
              subLabel={sync.pendingCount ? t('They send when there is internet.') : t('Everything has been sent.')}
            />
            <StatCard
              icon="pill"
              label={t('Doses waiting for review')}
              value={openReviews}
              tone={openReviews ? 'warning' : 'ok'}
              subLabel={openReviews ? t('A doctor at the district hospital checks these.') : t('Nothing waiting.')}
              to={openReviews && perms.canReviewConflicts ? '/conflicts' : undefined}
              action={t('Review now')}
            />
            <StatCard
              icon="merge"
              label={t('Edits merged automatically')}
              value={autoRate === null ? '—' : `${autoRate}%`}
              subLabel={
                stats.data
                  ? t('{auto} by the system, {manual} by a reviewer', { auto: stats.data.resolutions.automatic, manual: stats.data.resolutions.manual })
                  : t('Connect to the internet to see this.')
              }
            />
          </div>
        )}
      </section>

      {district && <CentresTable />}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card" aria-labelledby="recent-h">
          <SectionHeading
            id="recent-h"
            icon="clock"
            aside={
              <Link to="/patients" className="link">
                {t('See all patients')}
              </Link>
            }
          >
            {t('Recently updated patients')}
          </SectionHeading>
          {loading ? (
            <Loading />
          ) : patients.length === 0 ? (
            <EmptyState
              compact
              icon="patients"
              title={t('No patients yet')}
              message={t('Add a patient, or connect to the internet to get records from the server.')}
              action={
                perms.canEditPatients && (
                  <Link to="/patients/new" className="btn-primary">
                    <Icon name="plus" className="h-5 w-5" /> {t('Add a new patient')}
                  </Link>
                )
              }
            />
          ) : (
            <ul className="-mx-2 divide-y divide-slate-200 dark:divide-slate-800">
              {patients.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/patients/${p.id}`} className="group flex min-h-[3.5rem] items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <Avatar name={tName(p.name)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-slate-900 group-hover:underline dark:text-white">{tName(p.name)}</span>
                      <span className="block text-sm text-slate-700 dark:text-slate-300">{t('Updated {when}', { when: relativeTime(p.updatedAt) })}</span>
                    </span>
                    {p.hasOpenConflicts && (
                      <span className="badge-warning">
                        <Icon name="alert" className="h-4 w-4" /> {t('Dose review')}
                      </span>
                    )}
                    <Icon name="chevronRight" className="h-5 w-5 flex-shrink-0 text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <WeekChart />
      </div>

      {stats.data && (
        <section className="card" aria-labelledby="system-h">
          <SectionHeading id="system-h" icon="hospital">
            {t('Whole district (from the server)')}
          </SectionHeading>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Patients on the server', stats.data.patients],
              ['Doses waiting for review', stats.data.conflicts.pending],
              ['Doses reviewed', stats.data.conflicts.resolved],
              ['Registered devices', stats.data.devices],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-base text-slate-700 dark:text-slate-300">{t(label as string)}</dt>
                <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

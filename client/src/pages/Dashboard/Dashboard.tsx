/**
 * Dashboard — what is on this device, what still needs to sync, and how
 * conflicts are being resolved across the whole system.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { portalForRole, type StatsResponse } from '@shared/types';
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
import { EmptyState, PageHeader, SectionHeading, initials, relativeTime } from '../../components/ui';
import DistrictLanding from './landing/DistrictLanding';
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

function localDay(iso: string): string {
  return dayKey(new Date(iso));
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card flex gap-4">
            <div className="skeleton h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2"><div className="skeleton h-6 w-12" /><div className="skeleton h-3 w-24" /></div>
          </div>
        ))}
      </div>
      <div className="card"><div className="skeleton h-64 w-full" /></div>
    </div>
  );
}

export default function Dashboard() {
  const { patients, loading } = usePatients();
  const sync = useSyncEngine();
  const outbox = useOutboxWeek();
  const { user } = useAuth();
  const perms = usePermissions();
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const stats = useApi<StatsResponse>(sync.connected ? '/stats' : null, sync.lastSyncedAt);

  const chartData = useMemo(() => {
    const days = last7Days();
    const map = new Map(days.map((d) => [d, { day: d, synced: 0, pending: 0, conflicts: 0 }]));
    for (const r of outbox) {
      if (r.status === 'pending') {
        const e = map.get(localDay(r.createdAt));
        if (e) e.pending++;
      } else if (r.syncedAt) {
        const e = map.get(localDay(r.syncedAt));
        if (!e) continue;
        if (r.status === 'conflict') e.conflicts++;
        else if (r.status === 'synced' || r.status === 'resolved') e.synced++;
      }
    }
    return [...map.values()].map((d) => ({
      ...d,
      label: new Date(`${d.day}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' }),
    }));
  }, [outbox, locale]);

  const openConflicts = patients.filter((p) => p.hasOpenConflicts).length;
  const rate = stats.data
    ? (() => {
        const { automatic, manual } = stats.data.resolutions;
        const total = automatic + manual + stats.data.conflicts.pending;
        return total === 0 ? null : Math.round((automatic / total) * 100);
      })()
    : null;

  const axisColor = theme === 'dark' ? '#a39a88' : '#7a7263';
  const gridColor = theme === 'dark' ? '#2a2620' : '#e2dbcc';

  return (
    <div className="space-y-6">
      {user && portalForRole(user.role) === 'district' && <DistrictLanding stats={stats.data ?? null} />}
      <PageHeader
        title={t('Hello, {name}', { name: tName(greetingName(user?.name)) })}
        subtitle={
          user && portalForRole(user.role) === 'district'
            ? t("{facility}: every PHC's records, sync activity and conflict resolution at a glance.", { facility: tFacility(user.facility) })
            : t('{facility}: records on this device, sync activity and conflict resolution at a glance.', { facility: user?.facility ? tFacility(user.facility) : t('PHC') })
        }
        actions={
          perms.canEditPatients && (
            <Link to="/patients/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> {t('Add patient')}
            </Link>
          )
        }
      />

      

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard value={patients.length} label={t('Patients on this device')} icon="stethoscope" accent="medical" to="/patients" />
            <StatCard value={sync.pendingCount} label={t('Changes waiting to sync')} subLabel={t('Last sync {when}', { when: relativeTime(sync.lastSyncedAt) })} icon="hourglass" accent={sync.pendingCount ? 'warning' : 'teal'} />
            <StatCard
              value={openConflicts}
              label={t('Patients with a dose under review')}
              icon="alert"
              accent={openConflicts ? 'danger' : 'teal'}
              to={openConflicts ? (perms.canReviewConflicts ? '/conflicts' : '/patients') : undefined}
            />
            <StatCard
              value={rate === null ? '—' : `${rate}%`}
              label={t('Concurrent edits auto-resolved')}
              subLabel={stats.data ? t('{auto} automatic · {manual} by reviewers', { auto: stats.data.resolutions.automatic, manual: stats.data.resolutions.manual }) : t('Connect to load system stats')}
              icon="merge"
              accent="teal"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card lg:col-span-2" aria-labelledby="chart-h">
              <SectionHeading id="chart-h" icon="activity" aside={<span className="text-xs text-slate-400">{t('Changes by day')}</span>}>
                {t('This device, last 7 days')}
              </SectionHeading>
              <div className="h-64" role="img" aria-label={`${t('Bar chart of changes synced and pending over the last 7 days.')} ${chartData.map((d) => t('{day}: {synced} synced, {pending} pending, {conflicts} sent to review', { day: d.label, synced: d.synced, pending: d.pending, conflicts: d.conflicts })).join('; ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: theme === 'dark' ? '#1b1814' : '#fdfbf7', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: theme === 'dark' ? '#2a2620' : '#efe9dd' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="synced" name={t('Synced')} stackId="a" fill={theme === 'dark' ? '#9db9dc' : '#2f5f94'} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="conflicts" name={t('Sent to review')} stackId="a" fill={theme === 'dark' ? '#e6b95e' : '#c8901f'} />
                    <Bar dataKey="pending" name={t('Pending')} stackId="a" fill={theme === 'dark' ? '#a39a88' : '#7a7263'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card" aria-labelledby="system-h">
              <SectionHeading id="system-h" icon="hospital">{t('System')}</SectionHeading>
              {stats.data ? (
                <dl className="space-y-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">{t('Patients on server')}</dt>
                    <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{stats.data.patients}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">{t('Conflicts awaiting review')}</dt>
                    <dd className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">{stats.data.conflicts.pending}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">{t('Conflicts resolved')}</dt>
                    <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{stats.data.conflicts.resolved}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">{t('Registered devices')}</dt>
                    <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{stats.data.devices}</dd>
                  </div>
                  {rate !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{t('Auto-resolved')}</span><span>{t('Manual / pending')}</span>
                      </div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-orange-200 dark:bg-orange-900/50" role="img" aria-label={t('{rate}% of concurrent edits resolved automatically', { rate })}>
                        <div className="bg-sage-600 transition-[width] duration-700 ease-out" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )}
                  {perms.canReviewConflicts && stats.data.conflicts.pending > 0 && (
                    <Link to="/conflicts" className="btn-primary w-full">{t('Review conflicts')}</Link>
                  )}
                </dl>
              ) : (
                sync.connected ? (
                  <div className="space-y-4" aria-busy="true" aria-label={t('Loading')}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between"><div className="skeleton h-3.5 w-36" /><div className="skeleton h-5 w-8" /></div>
                    ))}
                  </div>
                ) : (
                  <EmptyState compact tone="slate" icon="wifiOff" title={t("You're offline")} message={t('System-wide stats appear when the server is reachable.')} />
                )
              )}
            </section>
          </div>

          <section className="card" aria-labelledby="recent-h">
            <SectionHeading
              id="recent-h"
              icon="clock"
              aside={
                <Link to="/patients" className="link inline-flex items-center gap-1 text-sm">
                  {t('All patients')} <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {t('Recently updated')}
            </SectionHeading>
            {patients.length === 0 ? (
              <EmptyState
                icon="patients"
                title={t('No patients yet')}
                message={t('Add a patient, or sync to download records from the server.')}
                action={perms.canEditPatients && <Link to="/patients/new" className="btn-primary">{t('Add your first patient')}</Link>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {patients.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/patients/${p.id}`} className="group -mx-3 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">{initials(tName(p.name))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-300">{tName(p.name)}</span>
                        <span className="block text-xs text-slate-400">{t('Updated {when}', { when: relativeTime(p.updatedAt) })}</span>
                      </span>
                      {p.hasOpenConflicts && <span className="badge-conflict">{t('Review')}</span>}
                      <Icon name="chevronRight" className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600 dark:text-slate-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

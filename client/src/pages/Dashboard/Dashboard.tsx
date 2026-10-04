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
import { EmptyState, PageHeader, initials, relativeTime } from '../../components/ui';

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
  if (!words.length) return 'there';
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
      label: new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
    }));
  }, [outbox]);

  const openConflicts = patients.filter((p) => p.hasOpenConflicts).length;
  const rate = stats.data
    ? (() => {
        const { automatic, manual } = stats.data.resolutions;
        const total = automatic + manual + stats.data.conflicts.pending;
        return total === 0 ? null : Math.round((automatic / total) * 100);
      })()
    : null;

  const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${greetingName(user?.name)}`}
        subtitle={
          user && portalForRole(user.role) === 'district'
            ? `${user.facility}: every PHC's records, sync activity and conflict resolution at a glance.`
            : `${user?.facility ?? 'PHC'}: records on this device, sync activity and conflict resolution at a glance.`
        }
        actions={
          perms.canEditPatients && (
            <Link to="/patients/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> Add patient
            </Link>
          )
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={patients.length} label="Patients on this device" icon="🩺" accent="medical" />
            <StatCard value={sync.pendingCount} label="Changes waiting to sync" subLabel={`Last sync ${relativeTime(sync.lastSyncedAt)}`} icon="⏳" accent={sync.pendingCount ? 'warning' : 'teal'} />
            <StatCard value={openConflicts} label="Patients with a dose under review" icon="⚠" accent={openConflicts ? 'danger' : 'teal'} />
            <StatCard
              value={rate === null ? '—' : `${rate}%`}
              label="Concurrent edits auto-resolved"
              subLabel={stats.data ? `${stats.data.resolutions.automatic} automatic · ${stats.data.resolutions.manual} by reviewers` : 'Connect to load system stats'}
              icon="🔀"
              accent="teal"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card lg:col-span-2" aria-labelledby="chart-h">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="chart-h" className="section-title">This device, last 7 days</h2>
                <span className="text-xs text-slate-400">changes by day</span>
              </div>
              <div className="h-64" role="img" aria-label={`Bar chart of changes synced and pending over the last 7 days. ${chartData.map((d) => `${d.label}: ${d.synced} synced, ${d.pending} pending, ${d.conflicts} sent to review`).join('; ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f1f5f9' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="synced" name="Synced" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="conflicts" name="Sent to review" stackId="a" fill="#f97316" />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card" aria-labelledby="system-h">
              <h2 id="system-h" className="section-title mb-4">System</h2>
              {stats.data ? (
                <dl className="space-y-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">Patients on server</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-white">{stats.data.patients}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">Conflicts awaiting review</dt>
                    <dd className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.data.conflicts.pending}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">Conflicts resolved</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-white">{stats.data.conflicts.resolved}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-600 dark:text-slate-300">Registered devices</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-white">{stats.data.devices}</dd>
                  </div>
                  {rate !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Auto-resolved</span><span>Manual / pending</span>
                      </div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-orange-200 dark:bg-orange-900/50" role="img" aria-label={`${rate}% of concurrent edits resolved automatically`}>
                        <div className="bg-teal-600" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )}
                  {perms.canReviewConflicts && stats.data.conflicts.pending > 0 && (
                    <Link to="/conflicts" className="btn-primary w-full">Review conflicts</Link>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">{sync.connected ? 'Loading…' : 'Offline. System-wide stats appear when the server is reachable.'}</p>
              )}
            </section>
          </div>

          <section className="card" aria-labelledby="recent-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="recent-h" className="section-title">Recently updated</h2>
              <Link to="/patients" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300">All patients</Link>
            </div>
            {patients.length === 0 ? (
              <EmptyState
                icon="patients"
                title="No patients yet"
                message="Add a patient, or sync to download records from the server."
                action={perms.canEditPatients && <Link to="/patients/new" className="btn-primary">Add your first patient</Link>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {patients.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/patients/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-100 text-xs font-semibold text-medical-700 dark:bg-medical-900/50 dark:text-medical-300">{initials(p.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                        <span className="block text-xs text-slate-400">Updated {relativeTime(p.updatedAt)}</span>
                      </span>
                      {p.hasOpenConflicts && <span className="badge-conflict">Review</span>}
                      <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
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

/**
 * Home. Answers three questions in order: what can I do now (register or find
 * a patient), what needs my attention (changes not sent, doses waiting for a
 * doctor), and what happened recently. Numbers are written as sentences and
 * tables, not tiles.
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
import { Loading, ageFrom, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
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
    <form onSubmit={submit} role="search">
      <label htmlFor="home-search" className="form-label-l">
        {t('Find a patient')}
      </label>
      <span className="form-hint" id="home-search-hint">
        {t('Type a name, phone number, allergy or medicine.')}
      </span>
      <div className="flex max-w-xl gap-3">
        <input id="home-search" type="search" className="input" aria-describedby="home-search-hint" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn-secondary flex-shrink-0">
          {t('Search')}
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
  const ink = dark ? '#ecedec' : '#0b0c0c';
  const rule = dark ? '#3b4247' : '#b1b4b6';
  const total = data.reduce((n, d) => n + d.synced + d.pending + d.conflicts, 0);

  return (
    <section className="section" aria-labelledby="chart-h">
      <h2 id="chart-h" className="heading-l">
        {t('Changes from this device in the last 7 days')}
      </h2>
      {total === 0 ? (
        <p className="mt-3">{t('No changes made on this device in the last 7 days.')}</p>
      ) : (
        <div
          className="mt-4 h-64"
          role="img"
          aria-label={`${t('Bar chart of changes by day.')} ${data
            .map((d) => t('{day}: {synced} sent, {pending} not sent yet, {conflicts} sent for dose review', { day: d.label, synced: d.synced, pending: d.pending, conflicts: d.conflicts }))
            .join('; ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={rule} vertical={false} />
              <XAxis dataKey="label" stroke={ink} fontSize={15} tickLine={false} />
              <YAxis allowDecimals={false} stroke={ink} fontSize={15} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: dark ? '#111416' : '#fff', border: `2px solid ${ink}`, borderRadius: 0, fontSize: 15 }} cursor={{ fill: dark ? '#1d2124' : '#f3f2f1' }} />
              <Legend wrapperStyle={{ fontSize: 15 }} iconType="square" />
              <Bar dataKey="synced" name={t('Sent')} stackId="a" fill={dark ? '#6cc38f' : '#0a4f47'} />
              <Bar dataKey="conflicts" name={t('Sent for dose review')} stackId="a" fill={dark ? '#f5c451' : '#b58105'} />
              <Bar dataKey="pending" name={t('Not sent yet')} stackId="a" fill={dark ? '#b1b6ba' : '#505a5f'} />
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
    <section className="section" aria-labelledby="centres-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="centres-h" className="heading-l">
          {t('Health centres')}
        </h2>
        <Link to="/phcs" className="link">
          {t('See all health centres')}
        </Link>
      </div>
      {!connected ? (
        <p className="mt-3">{t('Connect to the internet to see the health centres.')}</p>
      ) : !phcs.data ? (
        <Loading />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th scope="col">{t('Health centre')}</th>
                <th scope="col" className="table-num">{t('Patients')}</th>
                <th scope="col" className="table-num">{t('Tablets online')}</th>
                <th scope="col" className="table-num">{t('Doses waiting')}</th>
                <th scope="col">{t('Last update')}</th>
              </tr>
            </thead>
            <tbody>
              {phcs.data.phcs.map((p) => (
                <tr key={p.name}>
                  <th scope="row" className="font-bold">{tFacility(p.name)}</th>
                  <td className="table-num">{p.patientCount}</td>
                  <td className="table-num">
                    {p.devices.filter((d) => d.online).length} {t('of')} {p.devices.length}
                  </td>
                  <td className={`table-num ${p.openConflicts.length ? 'font-bold text-warn' : ''}`}>{p.openConflicts.length}</td>
                  <td>{relativeTime(p.lastSyncAt)}</td>
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
  const { t, tp, locale } = useI18n();
  const district = Boolean(user && portalForRole(user.role) === 'district');
  const stats = useApi<StatsResponse>(sync.connected ? '/stats' : null, sync.lastSyncedAt);
  const openReviews = patients.filter((p) => p.hasOpenConflicts).length;
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const attention: { tone: 'warn' | 'ok'; text: string; link?: { to: string; label: string } }[] = [];
  if (sync.pendingCount > 0)
    attention.push({
      tone: 'warn',
      text: tp(
        sync.pendingCount,
        '{count} change is saved only on this device. It will be sent to the server when there is internet.',
        '{count} changes are saved only on this device. They will be sent to the server when there is internet.',
      ),
    });
  if (openReviews > 0)
    attention.push({
      tone: 'warn',
      text: tp(
        openReviews,
        '{count} patient has a medicine dose waiting for a doctor to check it. Until then the earlier dose stays on the record.',
        '{count} patients have a medicine dose waiting for a doctor to check it. Until then the earlier dose stays on the record.',
      ),
      link: perms.canReviewConflicts ? { to: '/conflicts', label: t('Review the doses') } : { to: '/patients', label: t('See which patients') },
    });

  return (
    <div>
      <header className="mb-10">
        <span className="caption">{today}</span>
        <h1 className="heading-xl">{user ? tFacility(user.facility) : 'HealthSync'}</h1>
      </header>

      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:items-end">
        {perms.canEditPatients && (
          <div>
            <Link to="/patients/new" className="btn-start">
              {t('Register a patient')} <span aria-hidden="true">›</span>
            </Link>
            <p className="mt-2 text-muted">{t('For someone seen for the first time.')}</p>
          </div>
        )}
        <FindPatient />
      </div>

      <section className="section mt-12" aria-labelledby="attention-h">
        <h2 id="attention-h" className="heading-l">
          {t('Needs attention')}
        </h2>
        {attention.length === 0 ? (
          <p className="status-ok mt-3">{t('Nothing needs your attention. Every change has been sent.')}</p>
        ) : (
          <ul className="mt-3 border-t border-rule">
            {attention.map((a) => (
              <li key={a.text} className="flex flex-col gap-1 border-b border-rule py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="border-l-[5px] border-warn pl-3">{a.text}</span>
                {a.link && (
                  <Link to={a.link.to} className="link whitespace-nowrap font-bold">
                    {a.link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section mt-12" aria-labelledby="recent-h">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="recent-h" className="heading-l">
            {t('Recently updated patients')}
          </h2>
          <Link to="/patients" className="link">
            {tp(patients.length, 'See all {count} patient', 'See all {count} patients')}
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : patients.length === 0 ? (
          <p className="mt-3">{t('No patients yet. Register a patient, or connect to the internet to get records from the server.')}</p>
        ) : (
          <table className="table mt-4">
            <thead>
              <tr>
                <th scope="col">{t('Name')}</th>
                <th scope="col" className="max-sm:hidden">{t('Age')}</th>
                <th scope="col">{t('Last change')}</th>
              </tr>
            </thead>
            <tbody>
              {patients.slice(0, 6).map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/patients/${p.id}`} className="link font-bold">
                      {tName(p.name)}
                    </Link>
                    {p.hasOpenConflicts && <span className="status-warn mt-1 flex w-fit text-sm">{t('Dose waiting for review')}</span>}
                  </td>
                  <td className="max-sm:hidden">{ageFrom(p.dateOfBirth)}</td>
                  <td>{relativeTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {district && <CentresTable />}

      <WeekChart />

      {stats.data && (
        <section className="section" aria-labelledby="district-h">
          <h2 id="district-h" className="heading-l">
            {t('Across the district')}
          </h2>
          <dl className="summary mt-4">
            {(
              [
                ['Patients on the server', stats.data.patients],
                ['Doses waiting for review', stats.data.conflicts.pending],
                ['Doses reviewed', stats.data.conflicts.resolved],
                ['Edits two devices made at the same time, combined automatically', stats.data.resolutions.automatic],
                ['Registered devices', stats.data.devices],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="summary-row sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <dt>{t(label)}</dt>
                <dd className="font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

/**
 * Audit Trail — every merge decision, automatic or manual. Read-only by design:
 * the server exposes no route to edit or delete entries and blocks it at the model.
 */
import { useMemo, useState } from 'react';
import type { AuditEntry, HistoryPatient, PatientHistory } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { usePatients } from '../../hooks/usePatients';
import { AuditList } from '../../components/AuditList';
import { BranchGraph } from './BranchGraph';
import { Icon } from '../../components/Icon';
import {
  EmptyState,
  ErrorNotice,
  OfflineNotice,
  PageHeader,
  SkeletonRows,
} from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tName } from '../../i18n/names';

type TypeFilter = 'all' | 'automatic' | 'manual';
type View = 'graph' | 'list';

export default function AuditTrail() {
  const { connected } = useSyncEngine();
  const { patients } = usePatients();
  const [patientId, setPatientId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [concurrentOnly, setConcurrentOnly] = useState(false);
  const [view, setView] = useState<View>('graph');
  const { t, tp } = useI18n();

  // The graph is drawn per patient, from the server's own list (a device copy can
  // be out of date); it starts with the most contested record.
  const graphList = useApi<{ patients: HistoryPatient[] }>(
    connected && view === 'graph' ? '/audit-log/patients' : null,
    connected,
  );
  const graphPatients = graphList.data?.patients ?? [];
  const [graphPick, setGraphPick] = useState('');
  const graphPatient = graphPatients.some((p) => p.id === graphPick)
    ? graphPick
    : (graphPatients[0]?.id ?? '');
  const history = useApi<PatientHistory>(
    connected && view === 'graph' && graphPatient ? `/audit-log/history/${graphPatient}` : null,
    connected,
  );

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: '500' });
    if (patientId) p.set('patientId', patientId);
    // Send the bounds of the user's local days, not UTC days.
    if (from) p.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    if (type !== 'all') p.set('type', type);
    if (concurrentOnly) p.set('concurrentOnly', 'true');
    return `/audit-log?${p.toString()}`;
  }, [patientId, from, to, type, concurrentOnly]);

  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>(
    connected && view === 'list' ? query : null,
    connected,
  );
  const entries = data?.entries ?? [];
  const counts = {
    automatic: entries.filter((e) => e.resolutionType === 'automatic').length,
    manual: entries.filter((e) => e.resolutionType === 'manual').length,
  };

  const activeFilters = [
    patientId,
    from,
    to,
    type !== 'all' ? type : '',
    concurrentOnly ? 'c' : '',
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clear = () => {
    setPatientId('');
    setFrom('');
    setTo('');
    setType('all');
    setConcurrentOnly(false);
  };

  return (
    <div>
      <PageHeader
        title={t('Audit trail')}
        subtitle={
          <span className="flex items-start gap-1.5">
            <Icon name="lock" className="mt-1 h-3.5 w-3.5 flex-shrink-0" />{' '}
            {t('Append-only record of how every change was merged. Entries cannot be edited or deleted.')}
          </span>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
          role="tablist"
          aria-label={t('Audit view')}
        >
          {(
            [
              ['graph', 'Branch graph', 'git'],
              ['list', 'All entries', 'list'],
            ] as const
          ).map(([v, label, icon]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Icon name={icon} className="h-4 w-4" /> {t(label)}
            </button>
          ))}
        </div>
        {view === 'graph' && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2 sm:flex-none">
            <label htmlFor="graph-patient" className="text-sm text-slate-500 dark:text-slate-400">
              {t('Patient')}
            </label>
            <select
              id="graph-patient"
              className="form-input"
              value={graphPatient}
              onChange={(e) => setGraphPick(e.target.value)}
            >
              {graphPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${tName(p.name)} · ${tp(p.commits, '{count} edit', '{count} edits')} ${tp(p.devices, 'from {count} tablet', 'from {count} tablets')}${p.openConflicts ? ` · ${t('conflict open')}` : ''}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {view === 'graph' ? (
        !connected ? (
          <OfflineNotice message={t('The audit trail lives on the server. Connect to view it.')} />
        ) : graphList.error || history.error ? (
          <ErrorNotice
            message={`${t('Could not load the history:')} ${t(graphList.error ?? history.error ?? '')}`}
          />
        ) : graphList.data && graphPatients.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="git"
              tone="slate"
              title={t('No synced edits yet')}
              message={t('Patient edits appear here once a tablet syncs them.')}
            />
          </div>
        ) : !history.data || history.loading ? (
          <SkeletonRows rows={4} />
        ) : history.data.commits.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="git"
              tone="slate"
              title={t('No synced edits yet')}
              message={t("This patient's edits appear here once a tablet syncs them.")}
            />
          </div>
        ) : (
          <div className="card">
            <BranchGraph history={history.data} />
          </div>
        )
      ) : (
        <>
          <button
            type="button"
            className="btn-secondary mb-3 w-full justify-between md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="audit-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="list" className="h-4 w-4" /> {t('Filters')}
              {activeFilters > 0 && (
                <span className="rounded-full bg-teal-600 px-1.5 text-[11px] font-bold tabular-nums text-white">
                  {activeFilters}
                </span>
              )}
            </span>
            <Icon
              name="chevronDown"
              className={`h-4 w-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            id="audit-filters"
            className={`card mb-6 gap-4 md:grid md:grid-cols-2 lg:grid-cols-5 ${filtersOpen ? 'grid animate-fade-in' : 'hidden'}`}
          >
            <div className="lg:col-span-2">
              <label htmlFor="audit-patient" className="form-label">
                {t('Patient')}
              </label>
              <select
                id="audit-patient"
                className="form-input"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">{t('All patients')}</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {tName(p.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-from" className="form-label">
                {t('From')}
              </label>
              <input
                id="audit-from"
                type="date"
                className="form-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-to" className="form-label">
                {t('To')}
              </label>
              <input
                id="audit-to"
                type="date"
                className="form-input"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-type" className="form-label">
                {t('Resolution')}
              </label>
              <select
                id="audit-type"
                className="form-input"
                value={type}
                onChange={(e) => setType(e.target.value as TypeFilter)}
              >
                <option value="all">{t('All')}</option>
                <option value="automatic">{t('Automatic (CRDT rules)')}</option>
                <option value="manual">{t('Manual review')}</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 lg:col-span-5">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={concurrentOnly}
                  onChange={(e) => setConcurrentOnly(e.target.checked)}
                />
                {t('Only concurrent edits (real merges)')}
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">
                  {t('{entries} entries · {auto} automatic · {manual} manual', { entries: entries.length, auto: counts.automatic, manual: counts.manual })}
                </span>
                <button className="btn-ghost btn-sm" onClick={clear} disabled={activeFilters === 0}>
                  <Icon name="x" className="h-3.5 w-3.5" /> {t('Clear filters')}
                </button>
              </div>
            </div>
          </div>

          {!connected ? (
            <OfflineNotice message={t('The audit trail lives on the server. Connect to view it.')} />
          ) : loading && !data ? (
            <SkeletonRows rows={4} />
          ) : error ? (
            <ErrorNotice message={`${t('Could not load the audit trail:')} ${t(error)}`} />
          ) : entries.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="shield"
                tone="slate"
                title={t('No audit entries match')}
                message={t('Try widening the filters.')}
                action={
                  activeFilters > 0 && (
                    <button type="button" className="btn-secondary" onClick={clear}>
                      {t('Clear filters')}
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div className="card">
              <AuditList entries={entries} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

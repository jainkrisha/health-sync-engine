/**
 * Change history (audit trail) — every merge decision, automatic or manual.
 * Read-only by design: the server exposes no route to edit or delete entries
 * and blocks it at the model. "All changes" is a ledger with filters beside
 * it; "Timeline by device" draws one patient's edits per tablet.
 */
import { useMemo, useState } from 'react';
import type { AuditEntry, HistoryPatient, PatientHistory } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { usePatients } from '../../hooks/usePatients';
import { AuditList } from '../../components/AuditList';
import { BranchGraph } from './BranchGraph';
import { ErrorNotice, Loading, OfflineNotice, PageHeader } from '../../components/ui';
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
  const [view, setView] = useState<View>('list');
  const { t, tp } = useI18n();

  // The graph is drawn per patient, from the server's own list (a device copy can
  // be out of date); it starts with the most contested record.
  const graphList = useApi<{ patients: HistoryPatient[] }>(connected && view === 'graph' ? '/audit-log/patients' : null, connected);
  const graphPatients = graphList.data?.patients ?? [];
  const [graphPick, setGraphPick] = useState('');
  const graphPatient = graphPatients.some((p) => p.id === graphPick) ? graphPick : (graphPatients[0]?.id ?? '');
  const history = useApi<PatientHistory>(connected && view === 'graph' && graphPatient ? `/audit-log/history/${graphPatient}` : null, connected);

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

  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>(connected && view === 'list' ? query : null, connected);
  const entries = data?.entries ?? [];
  const counts = {
    automatic: entries.filter((e) => e.resolutionType === 'automatic').length,
    manual: entries.filter((e) => e.resolutionType === 'manual').length,
  };
  const activeFilters = [patientId, from, to, type !== 'all' ? type : '', concurrentOnly ? 'c' : ''].filter(Boolean).length;

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
        title={t('Change history')}
        lead={t('Every change to every record, and how it was saved when devices disagreed. Nobody can edit or delete these entries.')}
      />

      <div className="mb-8 flex flex-wrap gap-x-8 border-b border-rule" role="tablist" aria-label={t('How to show the history')}>
        {(
          [
            ['list', 'All changes'],
            ['graph', 'Timeline by device'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-[5px] pb-2 pt-1 text-base ${view === v ? 'border-band font-bold' : 'border-transparent text-link underline underline-offset-[0.15em]'}`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {!connected ? (
        <OfflineNotice message={t('The change history is kept on the server. Connect to the internet to see it.')} />
      ) : view === 'graph' ? (
        <>
          <div className="form-group">
            <label htmlFor="graph-patient" className="form-label">
              {t('Patient')}
            </label>
            <span className="form-hint">{t('Patients with the most edits from different devices come first.')}</span>
            <select id="graph-patient" className="select max-w-full" value={graphPatient} onChange={(e) => setGraphPick(e.target.value)}>
              {graphPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${tName(p.name)} · ${tp(p.commits, '{count} edit', '{count} edits')} ${tp(p.devices, 'from {count} tablet', 'from {count} tablets')}${p.openConflicts ? ` · ${t('conflict open')}` : ''}`}
                </option>
              ))}
            </select>
          </div>
          {graphList.error || history.error ? (
            <ErrorNotice message={`${t('Could not load the history:')} ${t(graphList.error ?? history.error ?? '')}`} />
          ) : graphList.data && graphPatients.length === 0 ? (
            <p>{t('Patient edits appear here once a tablet syncs them.')}</p>
          ) : !history.data || history.loading ? (
            <Loading />
          ) : history.data.commits.length === 0 ? (
            <p>{t("This patient's edits appear here once a tablet syncs them.")}</p>
          ) : (
            <BranchGraph history={history.data} />
          )}
        </>
      ) : (
        <div className="grid gap-10 md:grid-cols-[17rem_1fr]">
          <form className="md:border-r md:border-rule md:pr-8" onSubmit={(e) => e.preventDefault()} aria-label={t('Filter the history')}>
            <h2 className="heading-m mb-4">{t('Filter')}</h2>
            <div className="form-group">
              <label htmlFor="audit-patient" className="form-label">
                {t('Patient')}
              </label>
              <select id="audit-patient" className="select w-full" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">{t('All patients')}</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {tName(p.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="audit-from" className="form-label">
                {t('From')}
              </label>
              <input id="audit-from" type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="audit-to" className="form-label">
                {t('To')}
              </label>
              <input id="audit-to" type="date" className="input w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="audit-type" className="form-label">
                {t('Decided by')}
              </label>
              <select id="audit-type" className="select w-full" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
                <option value="all">{t('All')}</option>
                <option value="automatic">{t('Saved automatically by the system')}</option>
                <option value="manual">{t('Decided by a reviewer')}</option>
              </select>
            </div>
            <label className="radio form-group">
              <input type="checkbox" checked={concurrentOnly} onChange={(e) => setConcurrentOnly(e.target.checked)} />
              <span className="radio-label">{t('Only show changes made at the same time on two devices')}</span>
            </label>
            <button type="button" className="btn-text" onClick={clear} disabled={activeFilters === 0}>
              {t('Clear filters')}
            </button>
          </form>

          <div className="min-w-0">
            {loading && !data ? (
              <Loading />
            ) : error ? (
              <ErrorNotice message={`${t('Could not load the change history:')} ${t(error)}`} />
            ) : entries.length === 0 ? (
              <div>
                <h2 className="heading-m">{t('No changes match')}</h2>
                <p className="mt-2">{t('Try widening the filters.')}</p>
              </div>
            ) : (
              <>
                <p className="mb-3 font-bold">
                  {t('{entries} entries · {auto} automatic · {manual} manual', { entries: entries.length, auto: counts.automatic, manual: counts.manual })}
                </p>
                <AuditList entries={entries} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

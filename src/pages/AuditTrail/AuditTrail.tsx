/**
 * Audit Trail — every merge decision, automatic or manual. Read-only by design:
 * the server exposes no route to edit or delete entries and blocks it at the model.
 */
import { useMemo, useState } from 'react';
import type { AuditEntry } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { usePatients } from '../../hooks/usePatients';
import { AuditList } from '../../components/AuditList';
import { Icon } from '../../components/Icon';
import { EmptyState, OfflineNotice, PageHeader, SkeletonRows } from '../../components/ui';

type TypeFilter = 'all' | 'automatic' | 'manual';

export default function AuditTrail() {
  const { connected } = useSyncEngine();
  const { patients } = usePatients();
  const [patientId, setPatientId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [concurrentOnly, setConcurrentOnly] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: '500' });
    if (patientId) p.set('patientId', patientId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (type !== 'all') p.set('type', type);
    if (concurrentOnly) p.set('concurrentOnly', 'true');
    return `/audit-log?${p.toString()}`;
  }, [patientId, from, to, type, concurrentOnly]);

  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>(connected ? query : null, connected);
  const entries = data?.entries ?? [];
  const counts = {
    automatic: entries.filter((e) => e.resolutionType === 'automatic').length,
    manual: entries.filter((e) => e.resolutionType === 'manual').length,
  };

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
        title="Audit trail"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5" /> Append-only record of how every change was merged. Entries cannot be edited or deleted.
          </span>
        }
      />

      <div className="card mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="audit-patient" className="form-label">Patient</label>
          <select id="audit-patient" className="form-input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">All patients</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="form-label">From</label>
          <input id="audit-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="audit-to" className="form-label">To</label>
          <input id="audit-to" type="date" className="form-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="audit-type" className="form-label">Resolution</label>
          <select id="audit-type" className="form-input" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
            <option value="all">All</option>
            <option value="automatic">Automatic (CRDT rules)</option>
            <option value="manual">Manual review</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 lg:col-span-5">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={concurrentOnly} onChange={(e) => setConcurrentOnly(e.target.checked)} />
            Only concurrent edits (real merges)
          </label>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>{entries.length} entries · {counts.automatic} automatic · {counts.manual} manual</span>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={clear}>Clear filters</button>
          </div>
        </div>
      </div>

      {!connected ? (
        <OfflineNotice message="The audit trail lives on the server. Connect to view it." />
      ) : loading && !data ? (
        <SkeletonRows rows={4} />
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : entries.length === 0 ? (
        <EmptyState icon="shield" title="No audit entries match" message="Try widening the filters." />
      ) : (
        <div className="card">
          <AuditList entries={entries} />
        </div>
      )}
    </div>
  );
}

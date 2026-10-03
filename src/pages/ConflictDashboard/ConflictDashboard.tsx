/**
 * Conflict Review — medication changes made concurrently on different devices.
 * The server never auto-merges these; a clinical reviewer picks a value here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Conflict, ConflictChoice, MedicationCritical } from '@shared/types';
import { compare } from '@shared/vectorClock';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { syncEngine } from '../../sync/syncEngine';
import { useToast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import { ClockView, EmptyState, OfflineNotice, PageHeader, SkeletonRows, Spinner, formatDateTime, relativeTime, shortId } from '../../components/ui';

type Tab = 'pending_review' | 'resolved';

function describe(v: MedicationCritical): string {
  if (!v.active) return 'Stopped';
  return [v.dosage, v.frequency].filter(Boolean).join(' · ') || '(no dose)';
}

function ValuePanel({
  title,
  value,
  clientId,
  timestamp,
  clock,
  tone,
}: {
  title: string;
  value: MedicationCritical;
  clientId: string;
  timestamp: string;
  clock: Record<string, number>;
  tone: 'a' | 'b';
}) {
  return (
    <div className={`rounded-lg border p-4 ${tone === 'a' ? 'border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30' : 'border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{describe(value)}</p>
      <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex gap-2"><dt className="w-16 text-slate-400">Device</dt><dd className="font-mono">{clientId ? shortId(clientId) : 'unknown'}</dd></div>
        <div className="flex gap-2"><dt className="w-16 text-slate-400">Edited</dt><dd>{timestamp ? formatDateTime(timestamp) : '—'}</dd></div>
        <div className="flex gap-2"><dt className="w-16 text-slate-400">Clock</dt><dd><ClockView clock={clock} highlight={clientId} /></dd></div>
      </dl>
    </div>
  );
}

function ConflictCard({ conflict, onResolved }: { conflict: Conflict; onResolved: (c: Conflict) => void }) {
  const [open, setOpen] = useState(conflict.status === 'pending_review');
  const [custom, setCustom] = useState(false);
  const [dosage, setDosage] = useState(conflict.incomingValue.dosage);
  const [frequency, setFrequency] = useState(conflict.incomingValue.frequency);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ConflictChoice | null>(null);
  const { toast } = useToast();
  const pending = conflict.status === 'pending_review';
  const order = compare(conflict.currentClock, conflict.incomingClock);

  const resolve = async (choice: ConflictChoice) => {
    if (choice === 'custom' && !dosage.trim()) {
      toast({ message: 'Enter the corrected dosage', type: 'warning' });
      return;
    }
    setBusy(choice);
    try {
      const body: { choice: ConflictChoice; note?: string; value?: MedicationCritical } = { choice, note: note.trim() || undefined };
      if (choice === 'custom') body.value = { dosage: dosage.trim(), frequency: frequency.trim(), active: true };
      const res = await api<{ conflict: Conflict }>(`/conflicts/${conflict.id}/resolve`, { method: 'POST', body });
      toast({ message: `${conflict.label} for ${conflict.patientName} resolved`, type: 'success' });
      onResolved(res.conflict);
      void syncEngine.triggerSync();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Could not resolve', type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="relative">
      <span className={`absolute -left-[33px] top-5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-slate-50 dark:ring-slate-950 ${pending ? 'bg-orange-500' : 'bg-teal-500'}`} aria-hidden="true" />
      <article className="card p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-4 p-5 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{conflict.patientName || 'Patient'}</h3>
              <span className="badge-slate"><Icon name="pill" className="h-3 w-3" /> {conflict.label}</span>
              {pending ? <span className="badge-conflict">Awaiting review</span> : <span className="badge-teal">Resolved</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">{describe(conflict.currentValue)}</span> vs <span className="font-medium">{describe(conflict.incomingValue)}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Detected {relativeTime(conflict.createdAt)}</p>
          </div>
          <Icon name="chevronDown" className={`mt-1 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="space-y-4 border-t border-slate-100 p-5 dark:border-slate-800 fade-in">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The two edits are <strong>{order === 'concurrent' ? 'concurrent' : order}</strong>: neither device had seen the other's change when it was made, so the dose was not merged automatically.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <ValuePanel title="Value A (kept on the record for now)" value={conflict.currentValue} clientId={conflict.currentClientId} timestamp={conflict.currentTimestamp} clock={conflict.currentClock} tone="a" />
              <ValuePanel title="Value B (incoming edit)" value={conflict.incomingValue} clientId={conflict.incomingClientId} timestamp={conflict.incomingTimestamp} clock={conflict.incomingClock} tone="b" />
            </div>

            {pending ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor={`note-${conflict.id}`} className="form-label">Reviewer note (optional, saved to the audit trail)</label>
                  <input id={`note-${conflict.id}`} className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed with Dr. Shah by phone" />
                </div>
                {custom && (
                  <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`dose-${conflict.id}`} className="form-label">Corrected dosage</label>
                      <input id={`dose-${conflict.id}`} className="form-input" value={dosage} onChange={(e) => setDosage(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor={`freq-${conflict.id}`} className="form-label">Frequency</label>
                      <input id={`freq-${conflict.id}`} className="form-input" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled={busy !== null} onClick={() => void resolve('current')}>
                    {busy === 'current' ? <Spinner /> : <Icon name="check" className="h-4 w-4" />} Keep value A
                  </button>
                  <button className="btn-secondary" disabled={busy !== null} onClick={() => void resolve('incoming')}>
                    {busy === 'incoming' ? <Spinner /> : <Icon name="check" className="h-4 w-4" />} Keep value B
                  </button>
                  {custom ? (
                    <button className="btn-primary" disabled={busy !== null} onClick={() => void resolve('custom')}>
                      {busy === 'custom' && <Spinner />} Save corrected dose
                    </button>
                  ) : (
                    <button className="btn-ghost" onClick={() => setCustom(true)}>
                      <Icon name="edit" className="h-4 w-4" /> Enter a corrected dose
                    </button>
                  )}
                  <Link to={`/patients/${conflict.patientId}`} className="btn-ghost ml-auto">Open patient</Link>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-teal-50 p-4 text-sm text-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
                Resolved {formatDateTime(conflict.resolvedAt)} by <strong>{conflict.resolvedByName}</strong>:{' '}
                {conflict.resolution === 'custom' ? 'corrected to' : conflict.resolution === 'current' ? 'kept value A,' : 'kept value B,'}{' '}
                <strong>{conflict.resolvedValue ? describe(conflict.resolvedValue) : ''}</strong>
                {conflict.note && <p className="mt-1 text-xs opacity-80">Note: {conflict.note}</p>}
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

export default function ConflictDashboard() {
  const [tab, setTab] = useState<Tab>('pending_review');
  const { connected } = useSyncEngine();
  const { data, loading, error, reload, setData } = useApi<{ conflicts: Conflict[] }>(connected ? `/conflicts?status=${tab}` : null, connected);

  // Live updates: new conflicts and resolutions made by other reviewers.
  useEffect(
    () =>
      syncEngine.onConflict((c) => {
        setData((prev) => {
          if (!prev) return prev;
          const others = prev.conflicts.filter((x) => x.id !== c.id);
          return { conflicts: c.status === tab ? [c, ...others] : others };
        });
      }),
    [tab, setData],
  );

  const conflicts = data?.conflicts ?? [];

  return (
    <div>
      <PageHeader
        title="Conflict review"
        subtitle="Medication changes made at the same time on different devices. Pick the correct value; every decision is recorded in the audit trail."
        actions={
          <button className="btn-secondary" onClick={() => void reload()} disabled={!connected}>
            <Icon name="sync" className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {(['pending_review', 'resolved'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t === 'pending_review' ? 'Awaiting review' : 'Resolved'}
          </button>
        ))}
      </div>

      {!connected ? (
        <OfflineNotice message="Conflict review needs a connection to the server, because the decision has to reach every device. Patient records stay available offline." />
      ) : loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon="check"
          title={tab === 'pending_review' ? 'No conflicts waiting' : 'Nothing resolved yet'}
          message={tab === 'pending_review' ? 'When two devices change the same medication dose while offline, it will appear here.' : undefined}
        />
      ) : (
        <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6 dark:border-slate-800" aria-label="Conflicts, newest first">
          {conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onResolved={(updated) =>
                setData((prev) => (prev ? { conflicts: prev.conflicts.filter((x) => x.id !== updated.id || tab === 'resolved') } : prev))
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}

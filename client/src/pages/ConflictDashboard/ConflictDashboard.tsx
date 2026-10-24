/**
 * Dose reviews — when two devices changed the same medicine dose while
 * offline, the system does not guess. A clinical reviewer picks the correct
 * dose here (or types a new one), and every device gets the decision.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Conflict, ConflictChoice, MedicationCritical } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { syncEngine } from '../../sync/syncEngine';
import { useToast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import { ClockView, EmptyState, ErrorNotice, OfflineNotice, PageHeader, SkeletonRows, Spinner, formatDateTime, relativeTime, shortId } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { t } from '../../i18n/i18n';
import { tValue } from '../../i18n/clinical';
import { tName } from '../../i18n/names';

type Tab = 'pending_review' | 'resolved';

function describe(v: MedicationCritical): string {
  if (!v.active) return t('Stopped');
  return [v.dosage, v.frequency].filter(Boolean).map(tValue).join(' · ') || t('(no dose)');
}

function Option({
  letter,
  value,
  clientId,
  timestamp,
  clock,
  note,
}: {
  letter: 'A' | 'B';
  value: MedicationCritical;
  clientId: string;
  timestamp: string;
  clock: Record<string, number>;
  note: string;
}) {
  useI18n();
  return (
    <div className="rounded-lg border-2 border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
      <p className="text-base font-bold text-slate-700 dark:text-slate-300">{t('Dose {letter}', { letter })}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{describe(value)}</p>
      <p className="mt-2 text-base text-slate-700 dark:text-slate-300">
        {t('Entered {when}', { when: timestamp ? formatDateTime(timestamp) : '—' })}
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300">{t(note)}</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">{t('Technical details')}</summary>
        <dl className="mt-2 space-y-1">
          <div className="flex gap-2">
            <dt className="font-semibold">{t('Device')}</dt>
            <dd className="font-mono">{clientId ? shortId(clientId) : t('unknown')}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">{t('Clock')}</dt>
            <dd>
              <ClockView clock={clock} highlight={clientId} />
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function ConflictCard({ conflict, onResolved }: { conflict: Conflict; onResolved: (c: Conflict) => void }) {
  const [custom, setCustom] = useState(false);
  const [dosage, setDosage] = useState(conflict.incomingValue.dosage);
  const [frequency, setFrequency] = useState(conflict.incomingValue.frequency);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ConflictChoice | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { toast } = useToast();
  useI18n();
  const pending = conflict.status === 'pending_review';

  const resolve = async (choice: ConflictChoice) => {
    setProblem(null);
    if (choice === 'custom' && !dosage.trim()) {
      setProblem(t('Type the correct dose first.'));
      return;
    }
    setBusy(choice);
    try {
      const body: { choice: ConflictChoice; note?: string; value?: MedicationCritical } = { choice, note: note.trim() || undefined };
      if (choice === 'custom') body.value = { dosage: dosage.trim(), frequency: frequency.trim(), active: true };
      const res = await api<{ conflict: Conflict }>(`/conflicts/${conflict.id}/resolve`, { method: 'POST', body });
      toast({ message: t('Saved. {label} for {name} is resolved and sent to every device.', { label: tName(conflict.label), name: tName(conflict.patientName) }), type: 'success' });
      onResolved(res.conflict);
      void syncEngine.triggerSync();
    } catch (err) {
      setProblem(err instanceof Error ? t(err.message) : t('Could not save the decision. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li id={`conflict-${conflict.id}`} className="scroll-mt-28">
      <article className="card space-y-5" aria-labelledby={`conflict-h-${conflict.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`conflict-h-${conflict.id}`} className="text-xl font-bold text-slate-900 dark:text-white">
              {tName(conflict.patientName) || t('Patient')}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-lg text-slate-800 dark:text-slate-200">
              <Icon name="pill" className="h-5 w-5" /> {tName(conflict.label)}
            </p>
          </div>
          {pending ? (
            <span className="badge-warning text-base">
              <Icon name="clock" className="h-5 w-5" /> {t('Waiting since {when}', { when: relativeTime(conflict.createdAt) })}
            </span>
          ) : (
            <span className="badge-ok text-base">
              <Icon name="checkCircle" className="h-5 w-5" /> {t('Resolved')}
            </span>
          )}
        </div>

        <p className="text-base text-slate-800 dark:text-slate-200">
          {t('Two devices changed this dose while they were offline, so neither saw the other. The record keeps dose A until you decide.')}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Option letter="A" value={conflict.currentValue} clientId={conflict.currentClientId} timestamp={conflict.currentTimestamp} clock={conflict.currentClock} note="On the record now" />
          <Option letter="B" value={conflict.incomingValue} clientId={conflict.incomingClientId} timestamp={conflict.incomingTimestamp} clock={conflict.incomingClock} note="The other change" />
        </div>

        {pending ? (
          <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
              <label htmlFor={`note-${conflict.id}`} className="form-label">
                {t('Note for the record (optional)')}
              </label>
              <p className="form-help -mt-1 mb-1.5">{t('For example: Confirmed with the doctor by phone')}</p>
              <input id={`note-${conflict.id}`} className="form-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{t('Which dose is correct?')}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button className="btn-primary" disabled={busy !== null} onClick={() => void resolve('current')}>
                {busy === 'current' ? <Spinner /> : <Icon name="check" className="h-5 w-5" />} {t('Keep dose A')}
              </button>
              <button className="btn-primary" disabled={busy !== null} onClick={() => void resolve('incoming')}>
                {busy === 'incoming' ? <Spinner /> : <Icon name="check" className="h-5 w-5" />} {t('Use dose B')}
              </button>
              {!custom && (
                <button className="btn-secondary" onClick={() => setCustom(true)}>
                  <Icon name="edit" className="h-5 w-5" /> {t('Neither: enter the correct dose')}
                </button>
              )}
            </div>
            {custom && (
              <div className="grid gap-4 rounded-lg border-2 border-brand-600 bg-brand-50 p-4 sm:grid-cols-2 dark:border-brand-400 dark:bg-brand-950">
                <div>
                  <label htmlFor={`dose-${conflict.id}`} className="form-label">
                    {t('Correct dose')}
                  </label>
                  <input id={`dose-${conflict.id}`} className="form-input" value={dosage} onChange={(e) => setDosage(e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`freq-${conflict.id}`} className="form-label">
                    {t('How often?')}
                  </label>
                  <input id={`freq-${conflict.id}`} className="form-input" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-3 sm:col-span-2">
                  <button className="btn-primary" disabled={busy !== null} onClick={() => void resolve('custom')}>
                    {busy === 'custom' ? <Spinner /> : <Icon name="check" className="h-5 w-5" />} {t('Save the correct dose')}
                  </button>
                  <button className="btn-plain" onClick={() => setCustom(false)} disabled={busy !== null}>
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            )}
            {problem && (
              <div role="alert" className="notice-danger">
                <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <p>{problem}</p>
              </div>
            )}
            <Link to={`/patients/${conflict.patientId}`} className="link inline-flex items-center gap-1">
              {t('Open the patient record')} <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="notice-ok">
            <Icon name="checkCircle" className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p>
                {t('Resolved {when} by', { when: formatDateTime(conflict.resolvedAt) })} <strong>{tName(conflict.resolvedByName)}</strong>:{' '}
                {conflict.resolution === 'custom' ? t('corrected to') : conflict.resolution === 'current' ? t('kept dose A,') : t('chose dose B,')}{' '}
                <strong>{conflict.resolvedValue ? describe(conflict.resolvedValue) : ''}</strong>
              </p>
              {conflict.note && (
                <p className="mt-1">
                  {t('Note')}: {conflict.note}
                </p>
              )}
            </div>
          </div>
        )}
      </article>
    </li>
  );
}

export default function ConflictDashboard() {
  const [tab, setTab] = useState<Tab>('pending_review');
  useI18n();
  const { connected } = useSyncEngine();
  const { data, loading, error, reload, setData } = useApi<{ conflicts: Conflict[] }>(connected ? `/conflicts?status=${tab}` : null, connected);

  // Live updates: new cases and decisions made by other reviewers.
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
  const removeResolved = (updated: Conflict) => setData((prev) => (prev ? { conflicts: prev.conflicts.filter((x) => x.id !== updated.id || tab === 'resolved') } : prev));

  return (
    <div>
      <PageHeader
        title={t('Dose reviews')}
        subtitle={t('Sometimes two devices change the same medicine dose while they are offline. The system never guesses a dose: you choose the correct one here, and every device gets your decision.')}
        actions={
          <button className="btn-plain" onClick={() => void reload()} disabled={!connected}>
            <Icon name="sync" className="h-5 w-5" /> {t('Refresh')}
          </button>
        }
      />

      <div className="segmented mb-6" role="tablist" aria-label={t('Which reviews to show')}>
        {(['pending_review', 'resolved'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className="segmented-item">
            <Icon name={s === 'pending_review' ? 'clock' : 'checkCircle'} className="h-5 w-5" />
            {s === 'pending_review' ? t('Waiting for review') : t('Already reviewed')}
            {s === tab && data && <span className="tabular-nums">({conflicts.length})</span>}
          </button>
        ))}
      </div>

      {!connected ? (
        <OfflineNotice message={t('Dose reviews need the internet, because your decision has to reach every device. Patient records still work offline.')} />
      ) : loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load the dose reviews:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : conflicts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={tab === 'pending_review' ? 'checkCircle' : 'clock'}
            title={tab === 'pending_review' ? t('Nothing to review') : t('No reviews yet')}
            message={tab === 'pending_review' ? t('When two devices change the same dose while offline, it will appear here.') : t('Doses you or other reviewers decide will be listed here.')}
          />
        </div>
      ) : (
        <ol className="space-y-6" aria-label={t('Dose reviews, newest first')}>
          {conflicts.map((c) => (
            <ConflictCard key={c.id} conflict={c} onResolved={removeResolved} />
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Conflict Review — medication changes made concurrently on different devices.
 * The server never auto-merges these; a clinical reviewer picks a value here.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaseWave } from './CaseWave';
import { Link } from 'react-router-dom';
import type { Conflict, ConflictChoice, MedicationCritical } from '@shared/types';
import { compare } from '@shared/vectorClock';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { syncEngine } from '../../sync/syncEngine';
import { useToast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import { ClockView, EmptyState, ErrorNotice, OfflineNotice, PageHeader, SkeletonRows, Spinner, formatDateTime, relativeTime, shortId } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { t } from '../../i18n/i18n';

type Tab = 'pending_review' | 'resolved';

function describe(v: MedicationCritical): string {
  if (!v.active) return t('Stopped');
  return [v.dosage, v.frequency].filter(Boolean).join(' · ') || t('(no dose)');
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
  useI18n();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className={`eyebrow ${tone === 'a' ? 'text-medical-600 dark:text-medical-300' : 'text-[#9a5a42] dark:text-[#dba58f]'}`}>{title}</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">{describe(value)}</p>
      <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex gap-2"><dt className="w-16 text-slate-400">{t('Device')}</dt><dd className="font-mono">{clientId ? shortId(clientId) : t('unknown')}</dd></div>
        <div className="flex gap-2"><dt className="w-16 text-slate-400">{t('Edited')}</dt><dd>{timestamp ? formatDateTime(timestamp) : '—'}</dd></div>
        <div className="flex gap-2"><dt className="w-16 text-slate-400">{t('Clock')}</dt><dd><ClockView clock={clock} highlight={clientId} /></dd></div>
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
  useI18n();
  const pending = conflict.status === 'pending_review';
  const order = compare(conflict.currentClock, conflict.incomingClock);

  const resolve = async (choice: ConflictChoice) => {
    if (choice === 'custom' && !dosage.trim()) {
      toast({ message: t('Enter the corrected dosage'), type: 'warning' });
      return;
    }
    setBusy(choice);
    try {
      const body: { choice: ConflictChoice; note?: string; value?: MedicationCritical } = { choice, note: note.trim() || undefined };
      if (choice === 'custom') body.value = { dosage: dosage.trim(), frequency: frequency.trim(), active: true };
      const res = await api<{ conflict: Conflict }>(`/conflicts/${conflict.id}/resolve`, { method: 'POST', body });
      toast({ message: t('{label} for {name} resolved', { label: conflict.label, name: conflict.patientName }), type: 'success' });
      onResolved(res.conflict);
      void syncEngine.triggerSync();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : t('Could not resolve'), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="relative scroll-mt-28" id={`conflict-${conflict.id}`}>
      <span className={`absolute -left-[33px] top-5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-slate-50 dark:ring-slate-950 ${pending ? 'bg-orange-500' : 'bg-sage-500'}`} aria-hidden="true" />
      <article className={`card overflow-hidden p-0 transition-shadow sm:p-0 ${open ? 'shadow-card-lg' : 'hover:shadow-card-hover'}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50/60 sm:px-6 dark:hover:bg-slate-800/30"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{conflict.patientName || t('Patient')}</h3>
              <span className="badge-slate"><Icon name="pill" className="h-3 w-3" /> {conflict.label}</span>
              {pending ? <span className="badge-conflict">{t('Awaiting review')}</span> : <span className="badge-sage">{t('Resolved')}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">{describe(conflict.currentValue)}</span> {t('vs')} <span className="font-medium">{describe(conflict.incomingValue)}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{t('Detected {when}', { when: relativeTime(conflict.createdAt) })}</p>
          </div>
          <Icon name="chevronDown" className={`mt-1 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="fade-in space-y-5 border-t border-slate-100 p-5 sm:px-6 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('The two edits are')} <strong>{t(order)}</strong>: {t("neither device had seen the other's change when it was made, so the dose was not merged automatically.")}
            </p>
            {/* The two values side by side on the navy conflict card, as on the audit trail. */}
            <div className="relative grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 dark:border-[#4f6378] dark:bg-gradient-to-b dark:from-medical-700 dark:to-medical-900">
              <ValuePanel title={t('Value A (kept on the record for now)')} value={conflict.currentValue} clientId={conflict.currentClientId} timestamp={conflict.currentTimestamp} clock={conflict.currentClock} tone="a" />
              <ValuePanel title={t('Value B (incoming edit)')} value={conflict.incomingValue} clientId={conflict.incomingClientId} timestamp={conflict.incomingTimestamp} clock={conflict.incomingClock} tone="b" />
              <span className="absolute left-1/2 top-1/2 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-600 text-[11px] font-bold uppercase text-white ring-4 ring-slate-50 md:grid dark:bg-amber-300 dark:text-slate-900 dark:ring-[#24344a]" aria-hidden="true">
                {t('vs')}
              </span>
            </div>

            {pending ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor={`note-${conflict.id}`} className="form-label">{t('Reviewer note (optional, saved to the audit trail)')}</label>
                  <input id={`note-${conflict.id}`} className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. Confirmed with Dr. Shah by phone')} />
                </div>
                {custom && (
                  <div className="grid animate-fade-in gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2 dark:border-teal-900/60 dark:bg-teal-950/20">
                    <div>
                      <label htmlFor={`dose-${conflict.id}`} className="form-label">{t('Corrected dosage')}</label>
                      <input id={`dose-${conflict.id}`} className="form-input" value={dosage} onChange={(e) => setDosage(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor={`freq-${conflict.id}`} className="form-label">{t('Frequency')}</label>
                      <input id={`freq-${conflict.id}`} className="form-input" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button className="btn-secondary" disabled={busy !== null} onClick={() => void resolve('current')}>
                    {busy === 'current' ? <Spinner /> : <Icon name="check" className="h-4 w-4" />} {t('Keep value A')}
                  </button>
                  <button className="btn-secondary" disabled={busy !== null} onClick={() => void resolve('incoming')}>
                    {busy === 'incoming' ? <Spinner /> : <Icon name="check" className="h-4 w-4" />} {t('Keep value B')}
                  </button>
                  {custom ? (
                    <button className="btn-primary" disabled={busy !== null} onClick={() => void resolve('custom')}>
                      {busy === 'custom' && <Spinner />} {t('Save corrected dose')}
                    </button>
                  ) : (
                    <button className="btn-ghost" onClick={() => setCustom(true)}>
                      <Icon name="edit" className="h-4 w-4" /> {t('Enter a corrected dose')}
                    </button>
                  )}
                  <Link to={`/patients/${conflict.patientId}`} className="btn-ghost w-full sm:ml-auto sm:w-auto">{t('Open patient')} <Icon name="arrowRight" className="h-3.5 w-3.5" /></Link>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-900 ring-1 ring-inset ring-teal-600/10 dark:bg-teal-950/30 dark:text-teal-200">
                <Icon name="checkCircle" className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                {t('Resolved {when} by', { when: formatDateTime(conflict.resolvedAt) })} <strong>{conflict.resolvedByName}</strong>:{' '}
                {conflict.resolution === 'custom' ? t('corrected to') : conflict.resolution === 'current' ? t('kept value A,') : t('kept value B,')}{' '}
                <strong>{conflict.resolvedValue ? describe(conflict.resolvedValue) : ''}</strong>
                {conflict.note && <p className="mt-1 text-xs opacity-80">{t('Note')}: {conflict.note}</p>}
                </div>
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
  useI18n();
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
  // The wave shows the cases on the current tab; with nothing waiting it shows settled ones.
  const settled = useApi<{ conflicts: Conflict[] }>(connected && tab === 'pending_review' ? '/conflicts?status=resolved' : null, connected);
  const waveCases = conflicts.length ? conflicts : (settled.data?.conflicts ?? []);
  const [openCase, setOpenCase] = useState<Conflict | null>(null);
  const removeResolved = (updated: Conflict) =>
    setData((prev) => (prev ? { conflicts: prev.conflicts.filter((x) => x.id !== updated.id || tab === 'resolved') } : prev));

  // Escape closes the opened case.
  useEffect(() => {
    if (!openCase) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenCase(null);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [openCase]);

  return (
    <div>
      <PageHeader
        title={t('Conflict review')}
        subtitle={t('Medication changes made at the same time on different devices. Pick the correct value; every decision is recorded in the audit trail.')}
        actions={
          <button className="btn-secondary" onClick={() => void reload()} disabled={!connected}>
            <Icon name="sync" className="h-4 w-4" /> {t('Refresh')}
          </button>
        }
      />

      {connected && waveCases.length > 0 && <CaseWave cases={waveCases} onOpen={setOpenCase} />}

      {openCase &&
        createPortal(
          <div className="case-modal" role="dialog" aria-modal="true" aria-label={t('Case: {name}', { name: openCase.patientName })} onClick={(e) => e.target === e.currentTarget && setOpenCase(null)}>
            <div className="case-modal-panel">
              <div className="mb-3 flex justify-end">
                <button type="button" className="btn bg-white/90 text-slate-800 shadow-card hover:bg-white" onClick={() => setOpenCase(null)} autoFocus>
                  <Icon name="x" className="h-4 w-4" /> {t('Close')}
                </button>
              </div>
              <ul className="list-none">
                <ConflictCard
                  conflict={openCase}
                  onResolved={(updated) => {
                    removeResolved(updated);
                    setOpenCase(null);
                  }}
                />
              </ul>
            </div>
          </div>,
          document.body,
        )}

      <div className="segmented mb-6" role="tablist" aria-label={t('Conflict status')}>
        {(['pending_review', 'resolved'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className="segmented-item">
            {s === 'pending_review' ? t('Awaiting review') : t('Resolved')}
            {s === tab && data && (
              <span className={`ml-2 rounded-full px-1.5 text-xs tabular-nums ${s === 'pending_review' && conflicts.length ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {conflicts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!connected ? (
        <OfflineNotice message={t('Conflict review needs a connection to the server, because the decision has to reach every device. Patient records stay available offline.')} />
      ) : loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load conflicts:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : conflicts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={tab === 'pending_review' ? 'checkCircle' : 'clock'}
            tone={tab === 'pending_review' ? 'teal' : 'slate'}
            title={tab === 'pending_review' ? t('No conflicts waiting') : t('Nothing resolved yet')}
            message={tab === 'pending_review' ? t('When two devices change the same medication dose while offline, it will appear here.') : t('Decisions made by reviewers will be listed here.')}
          />
        </div>
      ) : (
        <ol className="stagger relative ml-2 space-y-5 border-l-2 border-slate-200 pl-6 dark:border-slate-800" aria-label={t('Conflicts, newest first')}>
          {conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onResolved={removeResolved}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Dose reviews. When two devices changed the same medicine dose while offline,
 * the system does not guess. Each case is one short form: the two doses side
 * by side in a table, one question ("Which dose is correct?") answered with
 * radio buttons, and one button. Every device gets the decision.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Conflict, ConflictChoice, MedicationCritical } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { syncEngine } from '../../sync/syncEngine';
import { useToast } from '../../components/Toast';
import { ErrorNotice, Loading, OfflineNotice, PageHeader, Spinner, formatDateTime, relativeTime, shortId } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { t } from '../../i18n/i18n';
import { tValue } from '../../i18n/clinical';
import { tName } from '../../i18n/names';

type Tab = 'pending_review' | 'resolved';

function describe(v: MedicationCritical): string {
  if (!v.active) return t('Stopped');
  return [v.dosage, v.frequency].filter(Boolean).map(tValue).join(' · ') || t('(no dose)');
}

function ConflictCase({ conflict, onResolved }: { conflict: Conflict; onResolved: (c: Conflict) => void }) {
  const [choice, setChoice] = useState<ConflictChoice | null>(null);
  const [dosage, setDosage] = useState(conflict.incomingValue.dosage);
  const [frequency, setFrequency] = useState(conflict.incomingValue.frequency);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { toast } = useToast();
  useI18n();
  const pending = conflict.status === 'pending_review';
  const id = conflict.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (!choice) return setProblem(t('Choose which dose is correct.'));
    if (choice === 'custom' && !dosage.trim()) return setProblem(t('Type the correct dose first.'));
    setBusy(true);
    try {
      const body: { choice: ConflictChoice; note?: string; value?: MedicationCritical } = { choice, note: note.trim() || undefined };
      if (choice === 'custom') body.value = { dosage: dosage.trim(), frequency: frequency.trim(), active: true };
      const res = await api<{ conflict: Conflict }>(`/conflicts/${id}/resolve`, { method: 'POST', body });
      toast({ message: t('Saved. {label} for {name} is resolved and sent to every device.', { label: tName(conflict.label), name: tName(conflict.patientName) }), type: 'success' });
      onResolved(res.conflict);
      void syncEngine.triggerSync();
    } catch (err) {
      setProblem(err instanceof Error ? t(err.message) : t('Could not save the decision. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const sides = [
    { key: 'A', title: t('Dose A'), sub: t('On the record now'), value: conflict.currentValue, client: conflict.currentClientId, at: conflict.currentTimestamp },
    { key: 'B', title: t('Dose B'), sub: t('The other change'), value: conflict.incomingValue, client: conflict.incomingClientId, at: conflict.incomingTimestamp },
  ];

  return (
    <li className="section" id={`conflict-${id}`}>
      <article aria-labelledby={`conflict-h-${id}`}>
        <span className="caption">{tName(conflict.label)}</span>
        <h2 id={`conflict-h-${id}`} className="heading-l">
          <Link to={`/patients/${conflict.patientId}`} className="link">
            {tName(conflict.patientName) || t('Patient')}
          </Link>
        </h2>
        <p className={`mt-2 ${pending ? 'status-warn' : 'status-ok'}`}>
          {pending ? t('Waiting since {when}', { when: relativeTime(conflict.createdAt) }) : t('Resolved')}
        </p>

        {pending && <p className="mt-4 max-w-[40rem]">{t('Two devices changed this dose while they were offline, so neither saw the other. The record keeps dose A until you decide.')}</p>}

        <div className="mt-5 overflow-x-auto">
          <table className="table min-w-[30rem]">
            <thead>
              <tr>
                <td />
                {sides.map((s) => (
                  <th key={s.key} scope="col">
                    {s.title}
                    <span className="block font-normal text-muted">{s.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('Dose and how often')}</th>
                {sides.map((s) => (
                  <td key={s.key} className="text-xl font-bold">
                    {describe(s.value)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t('Entered')}</th>
                {sides.map((s) => (
                  <td key={s.key}>{s.at ? formatDateTime(s.at) : '—'}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t('Device')}</th>
                {sides.map((s) => (
                  <td key={s.key}>
                    <span className="font-mono text-sm">{s.client ? shortId(s.client) : t('unknown')}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {pending ? (
          <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 max-w-[40rem]">
            {problem && (
              <div className="error-summary" role="alert">
                <h3 className="heading-m">{t('There is a problem')}</h3>
                <p className="mt-2 font-bold text-alert">{problem}</p>
              </div>
            )}
            <fieldset className="form-group">
              <legend className="form-label-l">{t('Which dose is correct?')}</legend>
              <div className="radios">
                {(
                  [
                    ['current', t('Keep dose A: {dose}', { dose: describe(conflict.currentValue) })],
                    ['incoming', t('Use dose B: {dose}', { dose: describe(conflict.incomingValue) })],
                    ['custom', t('Neither. Enter the correct dose')],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="radio">
                    <input type="radio" name={`choice-${id}`} checked={choice === value} onChange={() => setChoice(value)} />
                    <span className="radio-label font-bold">{label}</span>
                  </label>
                ))}
              </div>
              {choice === 'custom' && (
                <div className="ml-3.5 mt-4 border-l-[5px] border-rule pl-6">
                  <div className="form-group">
                    <label htmlFor={`dose-${id}`} className="form-label">
                      {t('Correct dose')}
                    </label>
                    <span className="form-hint">{t('For example: 500 mg')}</span>
                    <input id={`dose-${id}`} className="input w-chars-10" value={dosage} onChange={(e) => setDosage(e.target.value)} />
                  </div>
                  <div className="form-group mb-2">
                    <label htmlFor={`freq-${id}`} className="form-label">
                      {t('How often?')}
                    </label>
                    <input id={`freq-${id}`} className="input w-chars-20 max-w-full" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                  </div>
                </div>
              )}
            </fieldset>
            <div className="form-group">
              <label htmlFor={`note-${id}`} className="form-label">
                {t('Note for the record')} <span className="font-normal text-muted">{t('(optional)')}</span>
              </label>
              <span className="form-hint">{t('For example: Confirmed with the doctor by phone')}</span>
              <input id={`note-${id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Spinner />}
              {t('Save decision')}
            </button>
          </form>
        ) : (
          <div className="inset">
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
        caption={t('District hospital')}
        title={t('Dose reviews')}
        lead={t('Sometimes two devices change the same medicine dose while they are offline. The system never guesses a dose: you choose the correct one here, and every device gets your decision.')}
      />

      <div className="mb-8 flex flex-wrap gap-x-8 border-b border-rule" role="tablist" aria-label={t('Which reviews to show')}>
        {(['pending_review', 'resolved'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`-mb-px border-b-[5px] pb-2 pt-1 text-base ${tab === s ? 'border-band font-bold' : 'border-transparent text-link underline underline-offset-[0.15em]'}`}
          >
            {s === 'pending_review' ? t('Waiting for review') : t('Already reviewed')}
            {s === tab && data && ` (${conflicts.length})`}
          </button>
        ))}
        <button className="btn-text mb-2 ml-auto self-end text-sm" onClick={() => void reload()} disabled={!connected}>
          {t('Refresh')}
        </button>
      </div>

      {!connected ? (
        <OfflineNotice message={t('Dose reviews need the internet, because your decision has to reach every device. Patient records still work offline.')} />
      ) : loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load the dose reviews:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : conflicts.length === 0 ? (
        <div>
          <h2 className="heading-m">{tab === 'pending_review' ? t('Nothing to review') : t('No reviews yet')}</h2>
          <p className="mt-2">
            {tab === 'pending_review' ? t('When two devices change the same dose while offline, it will appear here.') : t('Doses you or other reviewers decide will be listed here.')}
          </p>
        </div>
      ) : (
        <ol className="space-y-0" aria-label={t('Dose reviews, newest first')}>
          {conflicts.map((c) => (
            <ConflictCase key={c.id} conflict={c} onResolved={removeResolved} />
          ))}
        </ol>
      )}
    </div>
  );
}

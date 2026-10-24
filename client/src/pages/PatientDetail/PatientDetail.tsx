/**
 * One patient's record, read top to bottom like a case sheet:
 *  - the patient banner (who this is, beyond doubt),
 *  - the allergy band (red, like the wristband) and any dose waiting for review,
 *  - medicines, then check-ups with out-of-range readings marked,
 *  - personal details, how the record was saved, and removal at the very end.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildDeleteMutation } from '@shared/diff';
import type { AuditEntry, Patient, VitalReading } from '@shared/types';
import { usePatient } from '../../hooks/usePatients';
import { usePendingIds } from '../../hooks/usePendingIds';
import { useSyncEngine } from '../../hooks/useSync';
import { usePermissions } from '../../context/RBAC';
import { useAuth } from '../../context/AuthContext';
import { commitLocalEdit } from '../../db/patientRepo';
import { getClientId } from '../../lib/deviceProfile';
import { flagOf, type Flag } from '../../lib/vitalFlags';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AuditList } from '../../components/AuditList';
import { ExportPanel } from '../../components/ExportPanel';
import { useI18n } from '../../i18n/useI18n';
import { tValue } from '../../i18n/clinical';
import { BackLink, ClockView, ErrorNotice, Loading, ageFrom, formatDate, formatDateTime, recordNumber, relativeTime } from '../../components/ui';
import { tName } from '../../i18n/names';

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** A reading, with "High" or "Low" beside it when outside the usual adult range. */
function Reading({ field, value, unit = '' }: { field: keyof VitalReading; value: number | string | undefined; unit?: string }) {
  const { t } = useI18n();
  if (value === undefined || value === '') return <span className="text-muted">—</span>;
  const flag: Flag = flagOf(field, value);
  return (
    <span className={flag ? 'font-bold' : undefined}>
      {value}
      {unit}
      {flag && <span className="ml-1.5 text-sm font-bold text-alert">{flag === 'high' ? t('High') : t('Low')}</span>}
    </span>
  );
}

function History({ patientId }: { patientId: string }) {
  const { connected } = useSyncEngine();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!connected) return;
    let active = true;
    api<{ entries: AuditEntry[] }>(`/patients/${patientId}/history`)
      .then((r) => active && (setEntries(r.entries), setError(null)))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [patientId, connected]);

  if (!connected && !entries) return <p>{t('Connect to the internet to see how each change was saved.')}</p>;
  if (error) return <ErrorNotice message={`${t('Could not load the history:')} ${t(error)}`} />;
  if (!entries) return <Loading />;
  if (entries.length === 0) return <p>{t('Nothing yet. The history appears after this record is sent to the server.')}</p>;
  return <AuditList entries={entries} showPatient={false} />;
}

function AllergyBand({ patient }: { patient: Patient }) {
  const { t } = useI18n();
  if (patient.allergies.length === 0) {
    return (
      <div className="inset my-0">
        <p>
          <strong>{t('Allergies')}:</strong> {t('No known allergies')}
        </p>
      </div>
    );
  }
  return (
    <section className="allergy-band" aria-labelledby="allergies-h">
      <h2 id="allergies-h" className="heading-m text-alert">
        {t('Allergies')}
      </h2>
      <ul className="mt-2 space-y-1">
        {patient.allergies.map((a) => (
          <li key={a.allergen}>
            <strong className="text-lg">{tName(a.allergen)}</strong>
            {(a.severity !== 'unknown' || a.reaction) && (
              <span>
                {' '}
                — {[a.severity !== 'unknown' ? t(capitalize(a.severity)) : '', tValue(a.reaction)].filter(Boolean).join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { doc, patient, loading } = usePatient(id);
  const pendingIds = usePendingIds();
  const perms = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { t, tp } = useI18n();

  if (loading) return <Loading />;
  if (!patient || !doc || patient.deleted) {
    return (
      <div>
        <BackLink to="/patients" label={t('Patients')} />
        <h1 className="heading-xl">{t('Patient not found')}</h1>
        <p className="lead mt-4">{t('This record is not on this device. It may have been removed, or it has not arrived here yet.')}</p>
      </div>
    );
  }

  const archive = async () => {
    setConfirmArchive(false);
    if (!user) return;
    try {
      await commitLocalEdit(patient.id, (current) =>
        current
          ? [
              buildDeleteMutation(current, {
                clientId: getClientId(),
                userId: user.id,
                userName: user.name,
                now: new Date().toISOString(),
                newId: () => crypto.randomUUID(),
              }),
            ]
          : [],
      );
      toast({ message: t('{name} removed from the patient list', { name: tName(patient.name) }), type: 'success' });
      navigate('/patients');
    } catch (err) {
      toast({ message: `${t('Could not remove the record:')} ${err instanceof Error ? t(err.message) : t('unknown error')}`, type: 'error' });
    }
  };

  const pending = pendingIds.has(patient.id);
  const editLink = `/patients/${patient.id}/edit`;

  return (
    <div>
      <BackLink to="/patients" label={t('Patients')} />

      <section className="patient-banner" aria-label={t('Patient')}>
        <h1 className="heading-l">{tName(patient.name)}</h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('Born')}</dt>
            <dd className="font-bold">
              {formatDate(patient.dateOfBirth)} ({ageFrom(patient.dateOfBirth)})
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('Sex')}</dt>
            <dd className="font-bold">{t(capitalize(patient.gender))}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('Blood group')}</dt>
            <dd className="font-bold">{t(patient.bloodType)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('Phone')}</dt>
            <dd className="font-bold tabular-nums">{patient.contactNumber || '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('Record no.')}</dt>
            <dd className="font-mono font-semibold">{recordNumber(patient.id)}</dd>
          </div>
        </dl>
      </section>

      <AllergyBand patient={patient} />

      <div className="mt-6 space-y-3">
        {patient.hasOpenConflicts && (
          <p className="warning">
            <span className="warning-mark" aria-hidden="true">
              !
            </span>
            <span>
              {t('Medicine dose waiting for review')}.{' '}
              <span className="font-normal">{t('Two doses were entered on different devices. The earlier one stays until a doctor decides.')}</span>
              {perms.canReviewConflicts && (
                <>
                  {' '}
                  <Link to="/conflicts" className="link">
                    {t('Review now')}
                  </Link>
                </>
              )}
            </span>
          </p>
        )}
        <p className={pending ? 'status-warn' : 'status-ok'}>{pending ? t('Changes not sent yet') : t('Saved on the server')}</p>
      </div>

      {perms.canEditPatients && (
        <div className="mt-8">
          <Link to={editLink} className="btn-primary">
            {t('Edit record')}
          </Link>
          <p className="mt-2 text-muted">{t('Record a check-up, or change details, allergies or medicines.')}</p>
        </div>
      )}

      <section className="section mt-12" aria-labelledby="meds-h">
        <h2 id="meds-h" className="heading-l">
          {t('Medicines')}
        </h2>
        {patient.medications.length === 0 ? (
          <p className="mt-3">{t('No current medicines')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table min-w-[32rem]">
              <thead>
                <tr>
                  <th scope="col">{t('Medicine')}</th>
                  <th scope="col">{t('Dose and how often')}</th>
                  <th scope="col">{t('Since')}</th>
                </tr>
              </thead>
              <tbody>
                {patient.medications.map((m) => (
                  <tr key={m.name}>
                    <th scope="row" className="font-bold">
                      {tName(m.name)}
                      {m.openConflictIds.length > 0 && <span className="status-warn mt-1 flex w-fit text-sm">{t('Dose under review')}</span>}
                    </th>
                    <td>{[m.dosage, m.frequency].filter(Boolean).map(tValue).join(' · ') || t('No dose recorded')}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(m.startDate)}
                      {m.endDate && (
                        <span className="block text-muted">
                          {t('until')} {formatDate(m.endDate)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="vitals-h">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="vitals-h" className="heading-l">
            {t('Check-ups')}
          </h2>
          <span className="text-muted">{tp(patient.vitals.length, '{count} check-up', '{count} check-ups')}</span>
        </div>
        {patient.vitals.length === 0 ? (
          <p className="mt-3">{t('No check-up recorded yet.')}</p>
        ) : (
          <>
            <p className="mt-2 text-muted">{t('Newest first. Readings outside the usual adult range are marked High or Low.')}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="table min-w-[44rem] tabular-nums">
                <thead>
                  <tr>
                    <th scope="col">{t('Date')}</th>
                    <th scope="col">{t('Blood pressure')}</th>
                    <th scope="col">{t('Pulse')}</th>
                    <th scope="col">{t('Temperature')}</th>
                    <th scope="col">{t('Breathing')}</th>
                    <th scope="col">{t('Oxygen')}</th>
                    <th scope="col">{t('Taken by')}</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.vitals.map((v) => (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">{formatDateTime(v.recordedAt)}</td>
                      <td className="whitespace-nowrap">
                        <Reading field="bloodPressure" value={v.bloodPressure} />
                      </td>
                      <td>
                        <Reading field="heartRate" value={v.heartRate} />
                      </td>
                      <td className="whitespace-nowrap">
                        <Reading field="temperature" value={v.temperature} unit=" °C" />
                      </td>
                      <td>
                        <Reading field="respiratoryRate" value={v.respiratoryRate} />
                      </td>
                      <td>
                        <Reading field="oxygenSaturation" value={v.oxygenSaturation} unit="%" />
                      </td>
                      <td className="whitespace-nowrap">{tName(v.recordedBy) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted">{t('Blood pressure in mmHg. Pulse and breathing per minute.')}</p>
          </>
        )}
      </section>

      <section className="section" aria-labelledby="details-h">
        <h2 id="details-h" className="heading-l">
          {t('Personal details')}
        </h2>
        <dl className="summary mt-4">
          {(
            [
              ['Full name', tName(patient.name)],
              ['Date of birth', formatDate(patient.dateOfBirth)],
              ['Sex', t(capitalize(patient.gender))],
              ['Blood group', t(patient.bloodType)],
              ['Phone number', patient.contactNumber || '—'],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="summary-row">
              <dt className="summary-key">{t(label)}</dt>
              <dd>{value}</dd>
              <dd>
                {perms.canEditPatients && (
                  <Link to={editLink} className="link">
                    {t('Change')}
                    <span className="sr-only"> {t(label)}</span>
                  </Link>
                )}
              </dd>
            </div>
          ))}
          <div className="summary-row">
            <dt className="summary-key">{t('Registered on')}</dt>
            <dd>{formatDate(patient.createdAt)}</dd>
            <dd />
          </div>
          <div className="summary-row">
            <dt className="summary-key">{t('Last updated')}</dt>
            <dd>{relativeTime(patient.updatedAt)}</dd>
            <dd />
          </div>
        </dl>
      </section>

      <section className="section space-y-4" aria-labelledby="saving-h">
        <h2 id="saving-h" className="heading-l">
          {t('Saving and change history')}
        </h2>
        <p>
          {pending ? t('Some changes are saved only on this device. They will be sent when there is internet.') : t('This record matches the copy on the server.')}{' '}
          {t('On this device it is stored locked (encrypted).')}
        </p>
        <ExportPanel all={[patient]} summary={t('Download this record')} />
        {perms.canViewHistory && (
          <details className="details">
            <summary>{t('How each change was saved')}</summary>
            <div className="details-body">
              <History patientId={patient.id} />
            </div>
          </details>
        )}
        <details className="details">
          <summary>{t('Technical details')}</summary>
          <div className="details-body">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-bold">{t('Version vector (device:counter)')}</dt>
                <dd>
                  <ClockView clock={doc.clock} highlight={getClientId()} />
                </dd>
              </div>
              <div>
                <dt className="font-bold">{t('Storage')}</dt>
                <dd>{t('AES-256-GCM encrypted on this device')}</dd>
              </div>
              <div>
                <dt className="font-bold">{t('Record ID')}</dt>
                <dd className="break-all font-mono">{patient.id}</dd>
              </div>
            </dl>
          </div>
        </details>
      </section>

      {perms.canEditPatients && (
        <section className="section" aria-labelledby="remove-h">
          <h2 id="remove-h" className="heading-m">
            {t('Remove this record')}
          </h2>
          <p className="mt-2 max-w-[40rem]">{t('Use this only for a duplicate or a mistake. The record disappears from every device, but its history is kept.')}</p>
          <button className="btn-warning mt-4" onClick={() => setConfirmArchive(true)}>
            {t('Remove record')}
          </button>
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmArchive}
        title={t('Remove {name}?', { name: tName(patient.name) })}
        message={t('The record will be hidden on every device after the next sync. The full history stays in the change history.')}
        confirmText={t('Yes, remove')}
        cancelText={t('No, keep it')}
        variant="danger"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

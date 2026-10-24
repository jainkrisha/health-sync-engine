/**
 * One patient's record. Safety information (allergies, medicines) comes first,
 * then the latest check-up, the history of check-ups and personal details.
 * Sync details and the merge history sit at the end for those who need them.
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
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { AuditList } from '../../components/AuditList';
import { ExportPanel } from '../../components/ExportPanel';
import { useI18n } from '../../i18n/useI18n';
import { tValue } from '../../i18n/clinical';
import { ClockView, EmptyState, ErrorNotice, Loading, PageHeader, SectionHeading, SkeletonRows, ageFrom, formatDate, formatDateTime, relativeTime } from '../../components/ui';
import { tName } from '../../i18n/names';

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const SEVERITY: Record<string, { style: string; label: string }> = {
  severe: { style: 'badge-danger', label: 'Severe' },
  moderate: { style: 'badge-warning', label: 'Moderate' },
  mild: { style: 'badge-muted', label: 'Mild' },
  unknown: { style: 'badge-muted', label: 'Severity not known' },
};

/** One check-up reading as a labelled value with its unit. */
function Reading({ label, value, unit }: { label: string; value?: string | number; unit: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t(label)}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
        {value ?? '—'} {value !== undefined && <span className="text-base font-semibold text-slate-700 dark:text-slate-300">{t(unit)}</span>}
      </dd>
    </div>
  );
}

function LatestCheckup({ reading }: { reading: VitalReading | undefined }) {
  const { t } = useI18n();
  return (
    <section className="card" aria-labelledby="latest-h">
      <SectionHeading id="latest-h" icon="heart">
        {t('Latest check-up')}
      </SectionHeading>
      {reading ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Reading label="Blood pressure" value={reading.bloodPressure} unit="mmHg" />
            <Reading label="Pulse" value={reading.heartRate} unit="per minute" />
            <Reading label="Temperature" value={reading.temperature} unit="°C" />
            <Reading label="Breathing rate" value={reading.respiratoryRate} unit="per minute" />
            <Reading label="Oxygen level (SpO₂)" value={reading.oxygenSaturation} unit="%" />
          </dl>
          <p className="mt-3 text-base text-slate-700 dark:text-slate-300">
            {t('Taken {when} by {name}', { when: formatDateTime(reading.recordedAt), name: tName(reading.recordedBy) || t('unknown') })}
          </p>
        </>
      ) : (
        <p className="text-base text-slate-700 dark:text-slate-300">{t('No check-up recorded yet. Use "Edit record" to add one.')}</p>
      )}
    </section>
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

  if (!connected && !entries) return <p className="text-base">{t('Connect to the internet to see how each change was saved.')}</p>;
  if (error) return <ErrorNotice message={`${t('Could not load the history:')} ${t(error)}`} />;
  if (!entries) return <Loading />;
  if (entries.length === 0) return <p className="text-base">{t('Nothing yet. The history appears after this record is sent to the server.')}</p>;
  return <AuditList entries={entries} showPatient={false} />;
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

  if (loading) return <SkeletonRows rows={3} />;
  if (!patient || !doc || patient.deleted) {
    return (
      <div className="card">
        <EmptyState
          icon="patients"
          title={t('Patient not found')}
          message={t('This record is not on this device. It may have been removed, or it has not arrived here yet.')}
          action={
            <Link to="/patients" className="btn-primary">
              {t('Back to patients')}
            </Link>
          }
        />
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

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        back={{ to: '/patients', label: t('Patients') }}
        title={tName(patient.name)}
        subtitle={
          <span className="block space-y-2">
            <span className="block text-lg">
              {[ageFrom(patient.dateOfBirth), patient.gender !== 'unknown' ? t(capitalize(patient.gender)) : '', t('Blood {type}', { type: t(patient.bloodType) })]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {patient.contactNumber && (
              <span className="flex items-center gap-2">
                <Icon name="phone" className="h-5 w-5" /> {patient.contactNumber}
              </span>
            )}
            <span className="flex flex-wrap gap-x-5 gap-y-1">
              {pending ? (
                <span className="badge-warning text-base">
                  <Icon name="clock" className="h-5 w-5" /> {t('Changes not sent yet')}
                </span>
              ) : (
                <span className="badge-ok text-base">
                  <Icon name="checkCircle" className="h-5 w-5" /> {t('Saved on the server')}
                </span>
              )}
              {patient.hasOpenConflicts && (
                <span className="badge-warning text-base">
                  <Icon name="pill" className="h-5 w-5" /> {t('Medicine dose waiting for review')}
                </span>
              )}
            </span>
          </span>
        }
        actions={
          perms.canEditPatients && (
            <Link to={`/patients/${patient.id}/edit`} className="btn-primary">
              <Icon name="edit" className="h-5 w-5" /> {t('Edit record')}
            </Link>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AllergiesCard patient={patient} />
        <MedicationsCard patient={patient} canReview={perms.canReviewConflicts} />
      </div>

      <LatestCheckup reading={patient.vitals[0]} />

      <section className="card p-0 sm:p-0" aria-labelledby="vitals-h">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionHeading id="vitals-h" icon="activity" aside={tp(patient.vitals.length, '{count} check-up', '{count} check-ups')}>
            {t('All check-ups')}
          </SectionHeading>
        </div>
        {patient.vitals.length === 0 ? (
          <p className="px-5 pb-5 text-base sm:px-6">{t('Every check-up you record is kept here, newest first.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <caption className="sr-only">{t('All check-ups')}</caption>
              <thead>
                <tr>
                  {['Date', 'Blood pressure', 'Pulse', 'Temperature', 'Breathing rate', 'Oxygen (SpO₂)', 'Taken by'].map((h) => (
                    <th key={h} scope="col" className="table-head whitespace-nowrap first:pl-5 sm:first:pl-6">
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums dark:divide-slate-800">
                {patient.vitals.map((v) => (
                  <tr key={v.id}>
                    <td className="table-cell whitespace-nowrap pl-5 sm:pl-6">{formatDateTime(v.recordedAt)}</td>
                    <td className="table-cell">{v.bloodPressure ?? '—'}</td>
                    <td className="table-cell">{v.heartRate ?? '—'}</td>
                    <td className="table-cell">{v.temperature !== undefined ? `${v.temperature} °C` : '—'}</td>
                    <td className="table-cell">{v.respiratoryRate ?? '—'}</td>
                    <td className="table-cell">{v.oxygenSaturation !== undefined ? `${v.oxygenSaturation}%` : '—'}</td>
                    <td className="table-cell whitespace-nowrap">{tName(v.recordedBy) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="details-h">
        <SectionHeading id="details-h" icon="user">
          {t('Personal details')}
        </SectionHeading>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['Date of birth', formatDate(patient.dateOfBirth)],
              ['Gender', t(capitalize(patient.gender))],
              ['Blood group', t(patient.bloodType)],
              ['Phone number', patient.contactNumber || '—'],
              ['Registered on', formatDate(patient.createdAt)],
              ['Last updated', relativeTime(patient.updatedAt)],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t(label)}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card space-y-4" aria-labelledby="download-h">
        <SectionHeading id="download-h" icon="download">
          {t('Download this record')}
        </SectionHeading>
        <ExportPanel all={[patient]} />
      </section>

      <section className="card space-y-4" aria-labelledby="sync-h">
        <SectionHeading id="sync-h" icon="sync">
          {t('Saving and change history')}
        </SectionHeading>
        <p className="text-base">
          {pending ? t('Some changes are saved only on this device. They will be sent when there is internet.') : t('This record matches the copy on the server.')}{' '}
          {t('On this device it is stored locked (encrypted).')}
        </p>
        {perms.canViewHistory ? (
          <details className="rounded-lg border border-slate-300 p-4 dark:border-slate-700">
            <summary className="cursor-pointer text-base font-semibold">{t('How each change was saved')}</summary>
            <div className="mt-4">
              <History patientId={patient.id} />
            </div>
          </details>
        ) : (
          <p className="text-sm text-slate-700 dark:text-slate-300">{t('Dose reviewers, auditors and administrators can see how each change was saved.')}</p>
        )}
        <details className="rounded-lg border border-slate-300 p-4 dark:border-slate-700">
          <summary className="cursor-pointer text-base font-semibold">{t('Technical details')}</summary>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">{t('Version vector (device:counter)')}</dt>
              <dd className="mt-1">
                <ClockView clock={doc.clock} highlight={getClientId()} />
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t('Storage')}</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <Icon name="lock" className="h-4 w-4" /> {t('AES-256-GCM encrypted on this device')}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t('Record ID')}</dt>
              <dd className="mt-1 break-all font-mono">{patient.id}</dd>
            </div>
          </dl>
        </details>
      </section>

      {perms.canEditPatients && (
        <section className="card border-red-200 dark:border-red-900" aria-labelledby="remove-h">
          <h2 id="remove-h" className="text-lg font-bold text-slate-900 dark:text-white">
            {t('Remove this record')}
          </h2>
          <p className="mt-1 text-base text-slate-700 dark:text-slate-300">
            {t('Use this only for a duplicate or a mistake. The record disappears from every device, but its history is kept.')}
          </p>
          <button className="btn-danger-outline mt-4" onClick={() => setConfirmArchive(true)}>
            <Icon name="trash" className="h-5 w-5" /> {t('Remove record')}
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

function AllergiesCard({ patient }: { patient: Patient }) {
  const { t } = useI18n();
  const severe = patient.allergies.some((a) => a.severity === 'severe');
  return (
    <section className={`card border-l-[6px] ${severe ? 'border-l-red-700 dark:border-l-red-400' : 'border-l-slate-300 dark:border-l-slate-600'}`} aria-labelledby="allergies-h">
      <SectionHeading id="allergies-h" icon="alert">
        {t('Allergies')}
      </SectionHeading>
      {patient.allergies.length === 0 ? (
        <p className="flex items-center gap-2 text-base text-slate-800 dark:text-slate-200">
          <Icon name="check" className="h-5 w-5 text-green-700 dark:text-green-300" /> {t('No known allergies')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {patient.allergies.map((a) => (
            <li key={a.allergen} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{tName(a.allergen)}</p>
                {a.reaction && <p className="text-base text-slate-700 dark:text-slate-300">{t('Reaction: {reaction}', { reaction: tValue(a.reaction) })}</p>}
              </div>
              <span className={SEVERITY[a.severity].style}>
                {a.severity === 'severe' && <Icon name="alert" className="h-4 w-4" />}
                {t(SEVERITY[a.severity].label)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MedicationsCard({ patient, canReview }: { patient: Patient; canReview: boolean }) {
  const { t } = useI18n();
  return (
    <section className="card" aria-labelledby="meds-h">
      <SectionHeading id="meds-h" icon="pill">
        {t('Medicines')}
      </SectionHeading>
      {patient.medications.length === 0 ? (
        <p className="text-base text-slate-800 dark:text-slate-200">{t('No current medicines')}</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {patient.medications.map((m) => (
            <li key={m.name} className="py-3 first:pt-0 last:pb-0">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{tName(m.name)}</p>
              <p className="text-base text-slate-800 dark:text-slate-200">{[m.dosage, m.frequency].filter(Boolean).map(tValue).join(' · ') || t('No dose recorded')}</p>
              {(m.startDate || m.endDate) && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {m.endDate
                    ? t('From {start} to {end}', { start: formatDate(m.startDate), end: formatDate(m.endDate) })
                    : t('Since {start}, ongoing', { start: formatDate(m.startDate) })}
                </p>
              )}
              {m.openConflictIds.length > 0 && (
                <p className="mt-1.5">
                  {canReview ? (
                    <Link to="/conflicts" className="badge-warning underline underline-offset-4">
                      <Icon name="alert" className="h-4 w-4" /> {t('Two doses were entered. Review now')}
                    </Link>
                  ) : (
                    <span className="badge-warning">
                      <Icon name="alert" className="h-4 w-4" /> {t('Two doses were entered. A doctor will check which is right.')}
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

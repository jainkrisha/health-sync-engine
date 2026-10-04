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
import {
  ClockView,
  EmptyState,
  PageHeader,
  SkeletonRows,
  Spinner,
  ageFrom,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../../components/ui';

const SEVERITY_STYLE = { severe: 'badge-danger', moderate: 'badge-warning', mild: 'badge-teal', unknown: 'badge-slate' } as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}

function vitalsSummary(v: VitalReading): string[] {
  return [
    v.heartRate !== undefined ? `HR ${v.heartRate} bpm` : '',
    v.bloodPressure ? `BP ${v.bloodPressure}` : '',
    v.temperature !== undefined ? `Temp ${v.temperature} °C` : '',
    v.respiratoryRate !== undefined ? `RR ${v.respiratoryRate}/min` : '',
    v.oxygenSaturation !== undefined ? `SpO₂ ${v.oxygenSaturation}%` : '',
  ].filter(Boolean);
}

function History({ patientId }: { patientId: string }) {
  const { connected } = useSyncEngine();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!connected && !entries) return <p className="text-sm text-slate-500 dark:text-slate-400">Connect to load the merge history from the server.</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!entries) return <Spinner className="h-5 w-5 text-teal-600" />;
  if (entries.length === 0) return <p className="text-sm text-slate-500">No synced history yet.</p>;
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

  if (loading) return <SkeletonRows rows={3} />;
  if (!patient || !doc || patient.deleted) {
    return (
      <EmptyState
        icon="patients"
        title="Patient not found"
        message="This record is not on this device. It may have been archived, or it has not synced here yet."
        action={<Link to="/patients" className="btn-primary">Back to patients</Link>}
      />
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
      toast({ message: `${patient.name} archived`, type: 'success' });
      navigate('/patients');
    } catch (err) {
      toast({ message: `Could not archive: ${err instanceof Error ? err.message : 'unknown error'}`, type: 'error' });
    }
  };

  const latest = patient.vitals[0];
  const pending = pendingIds.has(patient.id);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={patient.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {[ageFrom(patient.dateOfBirth), patient.gender !== 'unknown' ? patient.gender : '', `Blood ${patient.bloodType}`].filter(Boolean).join(' · ')}
            {patient.hasOpenConflicts && <span className="badge-conflict"><Icon name="alert" className="h-3 w-3" /> Medication under review</span>}
            {pending ? <span className="badge-warning">Changes not synced yet</span> : <span className="badge-teal">Synced</span>}
          </span>
        }
        actions={
          perms.canEditPatients && (
            <>
              <Link to={`/patients/${patient.id}/edit`} className="btn-primary">
                <Icon name="edit" className="h-4 w-4" /> Edit
              </Link>
              <button className="btn-secondary text-rose-600 dark:text-rose-400" onClick={() => setConfirmArchive(true)}>
                <Icon name="trash" className="h-4 w-4" /> Archive
              </button>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="overview-h">
          <h2 id="overview-h" className="section-title mb-4">Overview</h2>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Field label="Date of birth" value={formatDate(patient.dateOfBirth)} />
            <Field label="Gender" value={patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)} />
            <Field label="Blood type" value={patient.bloodType} />
            <Field label="Contact" value={patient.contactNumber} />
            <Field label="Registered" value={formatDate(patient.createdAt)} />
            <Field label="Last updated" value={relativeTime(patient.updatedAt)} />
          </dl>
        </section>

        <section className="card" aria-labelledby="latest-h">
          <h2 id="latest-h" className="section-title mb-4 flex items-center gap-2"><Icon name="activity" className="h-4 w-4" /> Latest vitals</h2>
          {latest ? (
            <>
              <ul className="space-y-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                {vitalsSummary(latest).map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(latest.recordedAt)} by {latest.recordedBy || 'unknown'}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No readings yet.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AllergiesCard patient={patient} />
        <MedicationsCard patient={patient} canReview={perms.canReviewConflicts} />
      </div>

      <section className="card" aria-labelledby="vitals-h">
        <h2 id="vitals-h" className="section-title mb-4">Vitals history</h2>
        {patient.vitals.length === 0 ? (
          <p className="text-sm text-slate-500">No readings recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Recorded', 'Heart rate', 'BP', 'Temp', 'Resp.', 'SpO₂', 'By'].map((h) => <th key={h} className="table-head">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {patient.vitals.map((v) => (
                  <tr key={v.id}>
                    <td className="table-cell whitespace-nowrap">{formatDateTime(v.recordedAt)}</td>
                    <td className="table-cell">{v.heartRate ?? '—'}</td>
                    <td className="table-cell">{v.bloodPressure ?? '—'}</td>
                    <td className="table-cell">{v.temperature ?? '—'}</td>
                    <td className="table-cell">{v.respiratoryRate ?? '—'}</td>
                    <td className="table-cell">{v.oxygenSaturation ?? '—'}</td>
                    <td className="table-cell">{v.recordedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card" aria-labelledby="sync-h">
          <h2 id="sync-h" className="section-title mb-4 flex items-center gap-2"><Icon name="git" className="h-4 w-4" /> Sync details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Version vector (device:counter)</dt>
              <dd className="mt-1"><ClockView clock={doc.clock} highlight={getClientId()} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Status</dt>
              <dd className="mt-1">{pending ? 'Local edits waiting to sync' : 'Matches the last copy from the server'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Storage</dt>
              <dd className="mt-1 flex items-center gap-1.5"><Icon name="lock" className="h-3.5 w-3.5" /> AES-256-GCM encrypted on this device</dd>
            </div>
          </dl>
        </section>
        <section className="card lg:col-span-2" aria-labelledby="history-h">
          <h2 id="history-h" className="section-title mb-4">Merge history</h2>
          {perms.canViewHistory ? (
            <History patientId={patient.id} />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Clinical reviewers, auditors and admins can see how each change to this record was merged.</p>
          )}
        </section>
      </div>

      <ConfirmDialog
        isOpen={confirmArchive}
        title="Archive patient?"
        message={`${patient.name} will be hidden on every device after sync. The full history stays in the audit trail.`}
        confirmText="Archive"
        variant="danger"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

function AllergiesCard({ patient }: { patient: Patient }) {
  return (
    <section className="card" aria-labelledby="allergies-h">
      <h2 id="allergies-h" className="section-title mb-4">Allergies</h2>
      {patient.allergies.length === 0 ? (
        <p className="text-sm text-slate-500">No known allergies.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {patient.allergies.map((a) => (
            <li key={a.allergen} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.allergen}</p>
                {a.reaction && <p className="text-xs text-slate-500 dark:text-slate-400">{a.reaction}</p>}
              </div>
              <span className={SEVERITY_STYLE[a.severity]}>{a.severity}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MedicationsCard({ patient, canReview }: { patient: Patient; canReview: boolean }) {
  return (
    <section className="card" aria-labelledby="meds-h">
      <h2 id="meds-h" className="section-title mb-4 flex items-center gap-2"><Icon name="pill" className="h-4 w-4" /> Medications</h2>
      {patient.medications.length === 0 ? (
        <p className="text-sm text-slate-500">No current medications.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {patient.medications.map((m) => (
            <li key={m.name} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[m.dosage, m.frequency].filter(Boolean).join(' · ') || 'No dose recorded'}
                    {(m.startDate || m.endDate) && ` · ${formatDate(m.startDate)} → ${m.endDate ? formatDate(m.endDate) : 'ongoing'}`}
                  </p>
                </div>
                {m.openConflictIds.length > 0 &&
                  (canReview ? (
                    <Link to="/conflicts" className="badge-conflict hover:underline">Review dose</Link>
                  ) : (
                    <span className="badge-conflict">Under review</span>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

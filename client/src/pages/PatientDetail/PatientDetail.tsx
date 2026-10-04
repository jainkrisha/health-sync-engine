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
import { plural } from '@shared/text';
import {
  ClockView,
  EmptyState,
  ErrorNotice,
  PageHeader,
  SectionHeading,
  SkeletonRows,
  ageFrom,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../../components/ui';

const SEVERITY_STYLE = { severe: 'badge-danger', moderate: 'badge-warning', mild: 'badge-teal', unknown: 'badge-slate' } as const;

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clinical', label: 'Allergies & meds' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'sync', label: 'Sync & history' },
] as const;

/** In-page jump links for this long record; sticks under the header while scrolling. */
function SectionNav() {
  return (
    <nav aria-label="Sections of this record" className="sticky top-[4.75rem] z-10 mb-6">
      <ul className="segmented max-w-full gap-0.5 overflow-x-auto bg-white/85 shadow-card backdrop-blur-md dark:bg-slate-900/85">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="segmented-item block whitespace-nowrap text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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

  if (!connected && !entries) return <EmptyState compact tone="slate" icon="wifiOff" title="You're offline" message="Connect to load the merge history from the server." />;
  if (error) return <ErrorNotice message={`Could not load history: ${error}`} />;
  if (!entries)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading history">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2"><div className="skeleton h-3 w-2/5" /><div className="skeleton h-3.5 w-4/5" /></div>
        ))}
      </div>
    );
  if (entries.length === 0) return <EmptyState compact tone="slate" icon="git" title="No synced history yet" message="Merge decisions appear here after this record syncs." />;
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
      <div className="card">
        <EmptyState
          icon="patients"
          tone="slate"
          title="Patient not found"
          message="This record is not on this device. It may have been archived, or it has not synced here yet."
          action={<Link to="/patients" className="btn-primary">Back to patients</Link>}
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
      toast({ message: `${patient.name} archived`, type: 'success' });
      navigate('/patients');
    } catch (err) {
      toast({ message: `Could not archive: ${err instanceof Error ? err.message : 'unknown error'}`, type: 'error' });
    }
  };

  const latest = patient.vitals[0];
  const pending = pendingIds.has(patient.id);

  return (
    <div className="pb-10">
      <PageHeader
        back={{ to: '/patients', label: 'Patients' }}
        title={patient.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{[ageFrom(patient.dateOfBirth), patient.gender !== 'unknown' ? capitalize(patient.gender) : '', `Blood ${patient.bloodType}`].filter(Boolean).join(' · ')}</span>
            {patient.hasOpenConflicts && <span className="badge-conflict"><Icon name="alert" className="h-3 w-3" /> Medication under review</span>}
            {pending ? (
              <span className="badge-warning"><Icon name="clock" className="h-3 w-3" /> Changes not synced yet</span>
            ) : (
              <span className="badge-teal"><Icon name="check" className="h-3 w-3" /> Synced</span>
            )}
          </span>
        }
        actions={
          perms.canEditPatients && (
            <>
              <Link to={`/patients/${patient.id}/edit`} className="btn-primary">
                <Icon name="edit" className="h-4 w-4" /> Edit
              </Link>
              <button className="btn-danger-outline" onClick={() => setConfirmArchive(true)}>
                <Icon name="trash" className="h-4 w-4" /> Archive
              </button>
            </>
          )
        }
      />

      <SectionNav />

      <div className="space-y-6">
      <div id="overview" className="grid scroll-mt-32 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="overview-h">
          <SectionHeading id="overview-h" icon="user">Overview</SectionHeading>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
            <Field label="Date of birth" value={formatDate(patient.dateOfBirth)} />
            <Field label="Gender" value={capitalize(patient.gender)} />
            <Field label="Blood type" value={patient.bloodType} />
            <Field label="Contact" value={patient.contactNumber} />
            <Field label="Registered" value={formatDate(patient.createdAt)} />
            <Field label="Last updated" value={relativeTime(patient.updatedAt)} />
          </dl>
        </section>

        <section className="card" aria-labelledby="latest-h">
          <SectionHeading id="latest-h" icon="activity">Latest vitals</SectionHeading>
          {latest ? (
            <>
              <ul className="grid grid-cols-2 gap-2">
                {vitalsSummary(latest).map((s) => (
                  <li key={s} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-slate-800 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/60 dark:text-slate-100 dark:ring-slate-700/60">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(latest.recordedAt)} by {latest.recordedBy || 'unknown'}</p>
            </>
          ) : (
            <EmptyState compact tone="slate" icon="activity" title="No readings yet" />
          )}
        </section>
      </div>

      <div id="clinical" className="grid scroll-mt-32 gap-6 lg:grid-cols-2">
        <AllergiesCard patient={patient} />
        <MedicationsCard patient={patient} canReview={perms.canReviewConflicts} />
      </div>

      <section id="vitals" className="card scroll-mt-32" aria-labelledby="vitals-h">
        <SectionHeading id="vitals-h" icon="heart" aside={<span className="text-xs text-slate-400">{plural(patient.vitals.length, 'reading')}</span>}>Vitals history</SectionHeading>
        {patient.vitals.length === 0 ? (
          <EmptyState compact tone="slate" icon="heart" title="No readings recorded" message="Add a reading from the edit form; every reading is kept." />
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800">
                  {['Recorded', 'Heart rate', 'BP', 'Temp', 'Resp.', 'SpO₂', 'By'].map((h) => <th key={h} className="table-head whitespace-nowrap first:pl-5 sm:first:pl-6">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {patient.vitals.map((v) => (
                  <tr key={v.id} className="tabular-nums transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="table-cell whitespace-nowrap pl-5 sm:pl-6">{formatDateTime(v.recordedAt)}</td>
                    <td className="table-cell">{v.heartRate ?? '—'}</td>
                    <td className="table-cell">{v.bloodPressure ?? '—'}</td>
                    <td className="table-cell">{v.temperature ?? '—'}</td>
                    <td className="table-cell">{v.respiratoryRate ?? '—'}</td>
                    <td className="table-cell">{v.oxygenSaturation ?? '—'}</td>
                    <td className="table-cell whitespace-nowrap">{v.recordedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div id="sync" className="grid scroll-mt-32 gap-6 lg:grid-cols-3">
        <section className="card" aria-labelledby="sync-h">
          <SectionHeading id="sync-h" icon="git">Sync details</SectionHeading>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="eyebrow">Version vector (device:counter)</dt>
              <dd className="mt-1"><ClockView clock={doc.clock} highlight={getClientId()} /></dd>
            </div>
            <div>
              <dt className="eyebrow">Status</dt>
              <dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{pending ? 'Local edits waiting to sync' : 'Matches the last copy from the server'}</dd>
            </div>
            <div>
              <dt className="eyebrow">Storage</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200"><Icon name="lock" className="h-3.5 w-3.5" /> AES-256-GCM encrypted on this device</dd>
            </div>
          </dl>
        </section>
        <section className="card lg:col-span-2" aria-labelledby="history-h">
          <SectionHeading id="history-h" icon="merge">Merge history</SectionHeading>
          {perms.canViewHistory ? (
            <History patientId={patient.id} />
          ) : (
            <EmptyState compact tone="slate" icon="lock" title="Restricted" message="Clinical reviewers, auditors and admins can see how each change to this record was merged." />
          )}
        </section>
      </div>
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
      <SectionHeading id="allergies-h" icon="alert" aside={<span className="text-xs text-slate-400">Kept across devices</span>}>Allergies</SectionHeading>
      {patient.allergies.length === 0 ? (
        <EmptyState compact tone="slate" icon="check" title="No known allergies" />
      ) : (
        <ul className="-my-2.5 divide-y divide-slate-100 dark:divide-slate-800">
          {patient.allergies.map((a) => (
            <li key={a.allergen} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.allergen}</p>
                {a.reaction && <p className="text-xs text-slate-500 dark:text-slate-400">{a.reaction}</p>}
              </div>
              <span className={`${SEVERITY_STYLE[a.severity]} capitalize`}>{a.severity}</span>
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
      <SectionHeading id="meds-h" icon="pill" aside={<span className="text-xs text-slate-400">Dose changes reviewed</span>}>Medications</SectionHeading>
      {patient.medications.length === 0 ? (
        <EmptyState compact tone="slate" icon="pill" title="No current medications" />
      ) : (
        <ul className="-my-2.5 divide-y divide-slate-100 dark:divide-slate-800">
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
                    <Link to="/conflicts" className="badge-conflict transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/50">Review dose <Icon name="arrowRight" className="h-3 w-3" /></Link>
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

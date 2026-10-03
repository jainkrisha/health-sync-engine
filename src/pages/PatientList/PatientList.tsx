import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Patient } from '@shared/types';
import { usePatients } from '../../hooks/usePatients';
import { usePendingIds } from '../../hooks/usePendingIds';
import { usePermissions } from '../../context/RBAC';
import { Icon } from '../../components/Icon';
import { EmptyState, PageHeader, SkeletonRows, ageFrom, initials, relativeTime } from '../../components/ui';

type Filter = 'all' | 'conflicts' | 'pending' | 'allergies';

function matches(p: Patient, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(needle) ||
    p.contactNumber.includes(needle) ||
    p.allergies.some((a) => a.allergen.toLowerCase().includes(needle)) ||
    p.medications.some((m) => m.name.toLowerCase().includes(needle))
  );
}

function PatientBadges({ p, pending }: { p: Patient; pending: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.hasOpenConflicts && (
        <span className="badge-conflict">
          <Icon name="alert" className="h-3 w-3" /> Needs review
        </span>
      )}
      {pending && (
        <span className="badge-warning">
          <Icon name="clock" className="h-3 w-3" /> Not synced
        </span>
      )}
      {p.allergies.some((a) => a.severity === 'severe') && <span className="badge-danger">Severe allergy</span>}
    </div>
  );
}

export default function PatientList() {
  const { patients, loading, error } = usePatients();
  const pendingIds = usePendingIds();
  const { canEditPatients } = usePermissions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () =>
      patients
        .filter((p) => matches(p, query.trim()))
        .filter((p) => {
          if (filter === 'conflicts') return p.hasOpenConflicts;
          if (filter === 'pending') return pendingIds.has(p.id);
          if (filter === 'allergies') return p.allergies.length > 0;
          return true;
        }),
    [patients, query, filter, pendingIds],
  );

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: patients.length },
    { id: 'conflicts', label: 'Needs review', count: patients.filter((p) => p.hasOpenConflicts).length },
    { id: 'pending', label: 'Not synced', count: patients.filter((p) => pendingIds.has(p.id)).length },
    { id: 'allergies', label: 'Has allergies', count: patients.filter((p) => p.allergies.length > 0).length },
  ];

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Stored encrypted on this device and synced when a connection is available."
        actions={
          canEditPatients && (
            <Link to="/patients/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> Add patient
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="patient-search" className="sr-only">Search patients</label>
          <input
            id="patient-search"
            type="search"
            className="form-input pl-9"
            placeholder="Search by name, phone, allergy or medication"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter patients">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                filter === f.id
                  ? 'bg-teal-600 text-white ring-teal-600'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error mb-4" role="alert">Could not read local records: {error}</p>}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : patients.length === 0 ? (
        <EmptyState
          icon="patients"
          title="No patients on this device yet"
          message={canEditPatients ? 'Add a patient, or connect to sync records from other devices.' : 'Connect to sync records from the server.'}
          action={canEditPatients && <Link to="/patients/new" className="btn-primary">Add your first patient</Link>}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title="No matching patients" message="Try a different search or filter." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden p-0 md:block">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Blood</th>
                  <th className="table-head">Allergies</th>
                  <th className="table-head">Medications</th>
                  <th className="table-head">Updated</th>
                  <th className="table-head"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="table-cell">
                      <Link to={`/patients/${p.id}`} className="flex items-center gap-3 font-medium text-slate-900 hover:text-teal-700 dark:text-white dark:hover:text-teal-300">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">
                          {initials(p.name)}
                        </span>
                        <span>
                          <span className="block">{p.name}</span>
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                            {[ageFrom(p.dateOfBirth), p.gender !== 'unknown' ? p.gender : ''].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                      </Link>
                      <div className="ml-12 mt-1"><PatientBadges p={p} pending={pendingIds.has(p.id)} /></div>
                    </td>
                    <td className="table-cell">{p.bloodType}</td>
                    <td className="table-cell">
                      {p.allergies.length ? p.allergies.map((a) => a.allergen).join(', ') : <span className="text-slate-400">None</span>}
                    </td>
                    <td className="table-cell">{p.medications.length || <span className="text-slate-400">0</span>}</td>
                    <td className="table-cell whitespace-nowrap text-slate-500">{relativeTime(p.updatedAt)}</td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-1">
                        <Link to={`/patients/${p.id}`} className="btn-ghost px-2 py-1 text-xs">View</Link>
                        {canEditPatients && <Link to={`/patients/${p.id}/edit`} className="btn-ghost px-2 py-1 text-xs">Edit</Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="card block p-4 hover:border-teal-300">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">
                      {initials(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.bloodType} · {p.allergies.length} allergies · {p.medications.length} meds · {relativeTime(p.updatedAt)}
                      </p>
                    </div>
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-2"><PatientBadges p={p} pending={pendingIds.has(p.id)} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

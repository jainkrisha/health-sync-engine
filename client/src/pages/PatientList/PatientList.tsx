import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Patient } from '@shared/types';
import { usePatients } from '../../hooks/usePatients';
import { usePendingIds } from '../../hooks/usePendingIds';
import { usePermissions } from '../../context/RBAC';
import { Icon } from '../../components/Icon';
import { ExportPanel } from '../../components/ExportPanel';
import { Avatar, EmptyState, ErrorNotice, PageHeader, SkeletonRows, ageFrom, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tName } from '../../i18n/names';

type Filter = 'all' | 'conflicts' | 'pending' | 'allergies';

function matches(p: Patient, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(needle) ||
    tName(p.name).toLowerCase().includes(needle) ||
    p.contactNumber.replace(/\s/g, '').includes(needle.replace(/\s/g, '')) ||
    p.allergies.some((a) => a.allergen.toLowerCase().includes(needle)) ||
    p.medications.some((m) => m.name.toLowerCase().includes(needle))
  );
}

/** Status in words with an icon: dose review, not sent yet, severe allergy. */
function PatientStatus({ p, pending }: { p: Patient; pending: boolean }) {
  const severe = p.allergies.filter((a) => a.severity === 'severe');
  const { t } = useI18n();
  if (!p.hasOpenConflicts && !pending && !severe.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {severe.length > 0 && (
        <span className="badge-danger">
          <Icon name="alert" className="h-4 w-4" /> {t('Severe allergy: {list}', { list: severe.map((a) => tName(a.allergen)).join(', ') })}
        </span>
      )}
      {p.hasOpenConflicts && (
        <span className="badge-warning">
          <Icon name="pill" className="h-4 w-4" /> {t('Dose waiting for review')}
        </span>
      )}
      {pending && (
        <span className="badge-warning">
          <Icon name="clock" className="h-4 w-4" /> {t('Not sent yet')}
        </span>
      )}
    </div>
  );
}

export default function PatientList() {
  const { patients, loading, error } = usePatients();
  const pendingIds = usePendingIds();
  const { canEditPatients } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const { t, tp } = useI18n();

  // Keep the search in the address, so Back returns to the same list.
  useEffect(() => {
    const q = query.trim();
    if ((params.get('q') ?? '') !== q) setParams(q ? { q } : {}, { replace: true });
  }, [query, params, setParams]);

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
    { id: 'all', label: t('All patients'), count: patients.length },
    { id: 'conflicts', label: t('Dose waiting for review'), count: patients.filter((p) => p.hasOpenConflicts).length },
    { id: 'pending', label: t('Not sent yet'), count: patients.filter((p) => pendingIds.has(p.id)).length },
    { id: 'allergies', label: t('Has allergies'), count: patients.filter((p) => p.allergies.length > 0).length },
  ];

  const clearAll = () => {
    setQuery('');
    setFilter('all');
  };

  return (
    <div>
      <PageHeader
        title={t('Patients')}
        subtitle={t('Records saved on this device. Tap a name to open the full record.')}
        actions={
          canEditPatients && (
            <Link to="/patients/new" className="btn-primary">
              <Icon name="plus" className="h-5 w-5" /> {t('Add patient')}
            </Link>
          )
        }
      />

      <div className="card mb-6 space-y-5">
        <div role="search">
          <label htmlFor="patient-search" className="form-label">
            {t('Search patients')}
          </label>
          <p className="form-help -mt-1 mb-2" id="patient-search-help">
            {t('Type a name, phone number, allergy or medicine.')}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                id="patient-search"
                type="search"
                aria-describedby="patient-search-help"
                className="form-input pl-11 [&::-webkit-search-cancel-button]:hidden"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                className="btn-plain flex-shrink-0"
              >
                <Icon name="x" className="h-5 w-5" /> {t('Clear')}
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="form-label" id="filter-label">
            {t('Show')}
          </p>
          <div className="segmented" role="group" aria-labelledby="filter-label">
            {filters.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className="segmented-item">
                {f.label} <span className="tabular-nums">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <ExportPanel all={patients} shown={visible} />
      </div>

      {!loading && patients.length > 0 && (
        <p className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200" aria-live="polite">
          {tp(patients.length, 'Showing {shown} of {count} patient', 'Showing {shown} of {count} patients', { shown: visible.length })}
          {query.trim() && <> {t('matching')} &ldquo;{query.trim()}&rdquo;</>}
        </p>
      )}

      {error && (
        <div className="mb-4">
          <ErrorNotice message={`${t('Could not read the records on this device:')} ${error}`} />
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : patients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="patients"
            title={t('No patients on this device yet')}
            message={
              canEditPatients
                ? t('Add a patient, or connect to the internet to get records from the server.')
                : t('Connect to the internet to get records from the server.')
            }
            action={
              canEditPatients && (
                <Link to="/patients/new" className="btn-primary">
                  <Icon name="plus" className="h-5 w-5" /> {t('Add a new patient')}
                </Link>
              )
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title={t('No patients match')}
            message={t('Check the spelling, or try a different word or filter.')}
            action={
              <button type="button" className="btn-plain" onClick={clearAll}>
                {t('Clear search and show all patients')}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id}>
              <Link
                to={`/patients/${p.id}`}
                className="card group flex items-center gap-4 p-4 hover:border-brand-600 hover:bg-slate-50 sm:p-5 dark:hover:border-brand-300 dark:hover:bg-slate-800/60"
              >
                <Avatar name={tName(p.name)} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-bold text-slate-900 group-hover:underline dark:text-white">{tName(p.name)}</p>
                  <p className="text-base text-slate-700 dark:text-slate-300">
                    {[ageFrom(p.dateOfBirth), p.gender !== 'unknown' ? t(p.gender.charAt(0).toUpperCase() + p.gender.slice(1)) : '', t('Blood {type}', { type: t(p.bloodType) })]
                      .filter(Boolean)
                      .join(' · ')}
                    {p.contactNumber && (
                      <span className="whitespace-nowrap">
                        {' · '}
                        {p.contactNumber}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {tp(p.medications.length, '{count} medicine', '{count} medicines')} · {t('Updated {when}', { when: relativeTime(p.updatedAt) })}
                  </p>
                  <PatientStatus p={p} pending={pendingIds.has(p.id)} />
                </div>
                <span className="hidden items-center gap-1 font-semibold text-brand-700 sm:inline-flex dark:text-brand-300">
                  {t('Open')} <Icon name="chevronRight" className="h-5 w-5" />
                </span>
                <Icon name="chevronRight" className="h-6 w-6 flex-shrink-0 text-slate-500 sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

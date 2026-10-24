/**
 * Patients — a register of everyone on this device. Search and filters on the
 * left (above, on phones), the register on the right as a ruled table: name,
 * age and sex, phone, last change, and anything that needs care.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Patient } from '@shared/types';
import { usePatients } from '../../hooks/usePatients';
import { usePendingIds } from '../../hooks/usePendingIds';
import { usePermissions } from '../../context/RBAC';
import { useAuth } from '../../context/AuthContext';
import { ExportPanel } from '../../components/ExportPanel';
import { ErrorNotice, Loading, ageFrom, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
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

/** What needs care about this patient, in words. */
function Notes({ p, pending }: { p: Patient; pending: boolean }) {
  const severe = p.allergies.filter((a) => a.severity === 'severe');
  const { t } = useI18n();
  if (!p.hasOpenConflicts && !pending && !severe.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {severe.length > 0 && (
        <li className="status-alert">{t('Severe allergy: {list}', { list: severe.map((a) => tName(a.allergen)).join(', ') })}</li>
      )}
      {p.hasOpenConflicts && <li className="status-warn">{t('Dose waiting for review')}</li>}
      {pending && <li className="status-warn">{t('Not sent yet')}</li>}
    </ul>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PatientList() {
  const { patients, loading, error } = usePatients();
  const pendingIds = usePendingIds();
  const { canEditPatients } = usePermissions();
  const { user } = useAuth();
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

  return (
    <div>
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          {user && <span className="caption">{tFacility(user.facility)}</span>}
          <h1 className="heading-xl">{t('Patients')}</h1>
        </div>
        {canEditPatients && (
          <Link to="/patients/new" className="btn-primary self-start md:self-auto">
            {t('Register a patient')}
          </Link>
        )}
      </header>

      <div className="grid gap-10 md:grid-cols-[17rem_1fr]">
        <div className="space-y-8 md:border-r md:border-rule md:pr-8">
          <div role="search">
            <label htmlFor="patient-search" className="form-label">
              {t('Search patients')}
            </label>
            <span className="form-hint" id="patient-search-hint">
              {t('Name, phone, allergy or medicine')}
            </span>
            <input
              ref={searchRef}
              id="patient-search"
              type="search"
              aria-describedby="patient-search-hint"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            />
            {query && (
              <button
                type="button"
                className="btn-text mt-2 text-sm"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
              >
                {t('Clear search')}
              </button>
            )}
          </div>

          <fieldset>
            <legend className="form-label">{t('Show')}</legend>
            <div className="radios">
              {filters.map((f) => (
                <label key={f.id} className="radio">
                  <input type="radio" name="patient-filter" checked={filter === f.id} onChange={() => setFilter(f.id)} />
                  <span className="radio-label">
                    {f.label} <span className="text-muted">({f.count})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <ExportPanel all={patients} shown={visible} summary={t('Download patient list')} />
        </div>

        <div className="min-w-0">
          {!loading && patients.length > 0 && (
            <p className="mb-2 font-bold" aria-live="polite">
              {tp(patients.length, 'Showing {shown} of {count} patient', 'Showing {shown} of {count} patients', { shown: visible.length })}
              {query.trim() && (
                <span className="font-normal">
                  {' '}
                  {t('matching')} &ldquo;{query.trim()}&rdquo;
                </span>
              )}
            </p>
          )}

          {error && <ErrorNotice message={`${t('Could not read the records on this device:')} ${error}`} />}

          {loading ? (
            <Loading />
          ) : patients.length === 0 ? (
            <div className="border-t-2 border-ink pt-4">
              <h2 className="heading-m">{t('No patients on this device yet')}</h2>
              <p className="mt-2">
                {canEditPatients
                  ? t('Register a patient, or connect to the internet to get records from the server.')
                  : t('Connect to the internet to get records from the server.')}
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="border-t-2 border-ink pt-4">
              <h2 className="heading-m">{t('No patients match')}</h2>
              <p className="mt-2">{t('Check the spelling, or try a different word or filter.')}</p>
              <button
                type="button"
                className="btn-text mt-3"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                {t('Clear search and show all patients')}
              </button>
            </div>
          ) : (
            <table className="table">
              <caption className="sr-only">{t('Patients')}</caption>
              <thead className="border-t-2 border-ink">
                <tr>
                  <th scope="col">{t('Name')}</th>
                  <th scope="col" className="max-md:hidden">{t('Phone number')}</th>
                  <th scope="col" className="max-sm:hidden">{t('Last change')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/patients/${p.id}`} className="link text-lg font-bold">
                        {tName(p.name)}
                      </Link>
                      <span className="block text-muted">
                        {[ageFrom(p.dateOfBirth), p.gender !== 'unknown' ? t(cap(p.gender)) : '', t('Blood {type}', { type: t(p.bloodType) })].filter(Boolean).join(', ')}
                      </span>
                      <Notes p={p} pending={pendingIds.has(p.id)} />
                    </td>
                    <td className="whitespace-nowrap tabular-nums max-md:hidden">{p.contactNumber || '—'}</td>
                    <td className="whitespace-nowrap max-sm:hidden">{relativeTime(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

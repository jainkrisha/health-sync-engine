import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Patient } from '@shared/types';
import { usePatients } from '../../hooks/usePatients';
import { usePendingIds } from '../../hooks/usePendingIds';
import { usePermissions } from '../../context/RBAC';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorNotice, PageHeader, SkeletonRows, ageFrom, initials, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';

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
  const severe = p.allergies.some((a) => a.severity === 'severe');
  const { t } = useI18n();
  if (!p.hasOpenConflicts && !pending && !severe) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.hasOpenConflicts && (
        <span className="badge-conflict">
          <Icon name="alert" className="h-3 w-3" /> {t('Needs review')}
        </span>
      )}
      {pending && (
        <span className="badge-warning">
          <Icon name="clock" className="h-3 w-3" /> {t('Not synced')}
        </span>
      )}
      {severe && <span className="badge-danger">{t('Severe allergy')}</span>}
    </div>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 ${
        size === 'lg' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs'
      }`}
    >
      {initials(name)}
    </span>
  );
}

export default function PatientList() {
  const { patients, loading, error } = usePatients();
  const pendingIds = usePendingIds();
  const { canEditPatients } = usePermissions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t, tp } = useI18n();

  // "/" jumps to search, as in most record systems.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
    { id: 'all', label: t('All'), count: patients.length },
    { id: 'conflicts', label: t('Needs review'), count: patients.filter((p) => p.hasOpenConflicts).length },
    { id: 'pending', label: t('Not synced'), count: patients.filter((p) => pendingIds.has(p.id)).length },
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
        subtitle={t('Stored encrypted on this device and synced when a connection is available.')}
        actions={
          canEditPatients && (
            <Link to="/patients/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> {t('Add patient')}
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="patient-search" className="sr-only">{t('Search patients')}</label>
          <input
            ref={searchRef}
            id="patient-search"
            type="search"
            className="form-input pl-10 pr-12 [&::-webkit-search-cancel-button]:hidden"
            placeholder={t('Search by name, phone, allergy or medication')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="btn-icon absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2"
              aria-label={t('Clear search')}
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          ) : (
            <kbd
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-400 sm:block dark:border-slate-700 dark:bg-slate-800"
              title={t('Press / to search')}
            >
              /
            </kbd>
          )}
        </div>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          <div className="flex w-max gap-2" role="group" aria-label={t('Filter patients')}>
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ring-inset transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
                  filter === f.id
                    ? 'bg-teal-600 text-white shadow-teal-glow ring-teal-600'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 tabular-nums ${filter === f.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && patients.length > 0 && (
        <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          {tp(patients.length, 'Showing {shown} of {count} patient', 'Showing {shown} of {count} patients', { shown: visible.length })}
          {query.trim() && <> {t('matching')} &ldquo;{query.trim()}&rdquo;</>}
        </p>
      )}

      {error && (
        <div className="mb-4">
          <ErrorNotice message={`${t('Could not read local records:')} ${error}`} />
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : patients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="patients"
            title={t('No patients on this device yet')}
            message={canEditPatients ? t('Add a patient, or connect to sync records from other devices.') : t('Connect to sync records from the server.')}
            action={canEditPatients && <Link to="/patients/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" /> {t('Add your first patient')}</Link>}
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            tone="slate"
            title={t('No matching patients')}
            message={t('Try a different search or filter.')}
            action={<button type="button" className="btn-secondary" onClick={clearAll}>{t('Clear search and filters')}</button>}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden p-0 sm:p-0 md:block">
            <table className="w-full">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="table-head">{t('Patient')}</th>
                  <th className="table-head">{t('Blood')}</th>
                  <th className="table-head">{t('Allergies')}</th>
                  <th className="table-head">{t('Medications')}</th>
                  <th className="table-head">{t('Updated')}</th>
                  <th className="table-head"><span className="sr-only">{t('Actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    className="group cursor-pointer transition-colors hover:bg-teal-50/40 dark:hover:bg-slate-800/40"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('a,button')) navigate(`/patients/${p.id}`);
                    }}
                  >
                    <td className="table-cell">
                      <Link to={`/patients/${p.id}`} className="flex items-center gap-3 font-semibold text-slate-900 transition-colors group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-300">
                        <Avatar name={p.name} />
                        <span>
                          <span className="block">{p.name}</span>
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                            {[ageFrom(p.dateOfBirth), p.gender !== 'unknown' ? t(p.gender) : ''].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                      </Link>
                      <div className="ml-12 mt-1.5 empty:hidden"><PatientBadges p={p} pending={pendingIds.has(p.id)} /></div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-[13px] font-semibold text-slate-700 dark:text-slate-200">{t(p.bloodType)}</span>
                    </td>
                    <td className="table-cell max-w-[16rem]">
                      {p.allergies.length ? <span className="line-clamp-2">{p.allergies.map((a) => a.allergen).join(', ')}</span> : <span className="text-slate-400">{t('None')}</span>}
                    </td>
                    <td className="table-cell tabular-nums">{p.medications.length || <span className="text-slate-400">0</span>}</td>
                    <td className="table-cell whitespace-nowrap text-slate-500">{relativeTime(p.updatedAt)}</td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-1 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Link to={`/patients/${p.id}`} className="btn-ghost btn-sm">{t('View')}</Link>
                        {canEditPatients && (
                          <Link to={`/patients/${p.id}/edit`} className="btn-ghost btn-sm" aria-label={t('Edit {name}', { name: p.name })}>
                            <Icon name="edit" className="h-3.5 w-3.5" /> {t('Edit')}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="stagger space-y-3 md:hidden">
            {visible.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="card card-interactive block p-4 sm:p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t(p.bloodType)} · {tp(p.allergies.length, '{count} allergy', '{count} allergies')} · {tp(p.medications.length, '{count} med', '{count} meds')} · {relativeTime(p.updatedAt)}
                      </p>
                    </div>
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-2.5 empty:hidden"><PatientBadges p={p} pending={pendingIds.has(p.id)} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

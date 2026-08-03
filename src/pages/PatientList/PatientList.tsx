/**
 * PatientList.tsx — Patient list page.
 * OWNERSHIP: Person B.
 *
 * Reads patients from IndexedDB via usePatients(). No network calls.
 * Client-side search filter only — no new DB queries on keystroke.
 */

import { useState, useMemo, useId, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePatients } from '../../hooks/usePatients'
import { useToast } from '../../components/Toast'
import type { Patient } from '../../types/patient'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatUpdated(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return formatDate(iso)
}

function bloodTypeBadgeClass(bt: string): string {
  const map: Record<string, string> = {
    'A+': 'badge-teal',
    'A-': 'badge-teal',
    'B+': 'badge-blue',
    'B-': 'badge-blue',
    'AB+': 'badge-warning',
    'AB-': 'badge-warning',
    'O+': 'badge-danger',
    'O-': 'badge-danger',
  }
  return map[bt] ?? 'badge bg-slate-100 text-slate-600'
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────

interface ConfirmDialogProps {
  patientName: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ patientName, onConfirm, onCancel }: ConfirmDialogProps) {
  // Focus trap: keep Tab/Shift+Tab cycling inside the dialog
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onCancel()
      return
    }
    if (e.key !== 'Tab') return

    const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-40 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-overlay"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-50 w-full max-w-sm mx-4 card shadow-card-lg">
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900 mb-2"
        >
          Delete patient record?
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          <span className="font-medium text-slate-700">{patientName}</span>
          &apos;s record will be permanently deleted from this device. This
          cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            id="confirm-dialog-cancel"
            className="btn-secondary"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            id="confirm-dialog-confirm"
            className="btn-danger"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile card for a single patient ────────────────────────────────────────

interface PatientCardProps {
  patient: Patient
  onDeleteRequest: (patient: Patient) => void
}

function PatientCard({ patient, onDeleteRequest }: PatientCardProps) {
  return (
    <div className="card flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{patient.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            DOB: {formatDate(patient.dateOfBirth)}
          </p>
        </div>
        <span className={`badge ${bloodTypeBadgeClass(patient.bloodType)} flex-shrink-0`}>
          {patient.bloodType || '—'}
        </span>
      </div>

      {/* Allergy count */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Allergies:</span>
        {patient.allergies.length === 0 ? (
          <span className="text-slate-400">None recorded</span>
        ) : (
          <span className="badge-warning">
            {patient.allergies.length}{' '}
            {patient.allergies.length === 1 ? 'allergy' : 'allergies'}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Updated {formatUpdated(patient.updatedAt)}
        </span>
        <div className="flex gap-2">
          <Link
            to={`/patients/${patient.id}/edit`}
            className="btn-secondary py-1 px-3 text-xs"
            id={`edit-patient-${patient.id}`}
          >
            Edit
          </Link>
          <button
            className="btn-danger py-1 px-3 text-xs"
            onClick={() => onDeleteRequest(patient)}
            id={`delete-patient-${patient.id}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Desktop table row ────────────────────────────────────────────────────────

interface PatientRowProps {
  patient: Patient
  onDeleteRequest: (patient: Patient) => void
}

function PatientRow({ patient, onDeleteRequest }: PatientRowProps) {
  return (
    <tr className="group hover:bg-medical-50 transition-colors duration-100">
      <td className="py-3 px-4 text-sm font-medium text-slate-900">
        {patient.name}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {formatDate(patient.dateOfBirth)}
      </td>
      <td className="py-3 px-4">
        <span className={`badge ${bloodTypeBadgeClass(patient.bloodType)}`}>
          {patient.bloodType || '—'}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {patient.allergies.length === 0 ? (
          <span className="text-slate-400">None</span>
        ) : (
          <span className="badge-warning">
            {patient.allergies.length}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {formatUpdated(patient.updatedAt)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          <Link
            to={`/patients/${patient.id}/edit`}
            className="btn-secondary py-1 px-3 text-xs"
            id={`edit-patient-row-${patient.id}`}
          >
            Edit
          </Link>
          <button
            className="btn-danger py-1 px-3 text-xs"
            onClick={() => onDeleteRequest(patient)}
            id={`delete-patient-row-${patient.id}`}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3 select-none">🔍</div>
        <p className="text-base font-medium text-slate-700">No patients match your search</p>
        <p className="text-sm text-slate-400 mt-1">Try a different name</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-full bg-medical-50 flex items-center justify-center
                   text-medical-400 text-3xl mb-4 select-none"
      >
        🏥
      </div>
      <p className="text-base font-medium text-slate-700">No patient records yet</p>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        Add your first patient to get started
      </p>
      <Link to="/patients/new" className="btn-primary" id="empty-state-add-patient">
        Add your first patient
      </Link>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      {/* Desktop table skeleton — visible md+ */}
      <div className="hidden md:block card p-0 overflow-hidden animate-pulse">
        {/* Fake header */}
        <div className="flex gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
          {[110, 90, 70, 60, 80, 48].map((w, i) => (
            <div key={i} className={`h-3 bg-slate-200 rounded`} style={{ width: w }} />
          ))}
        </div>
        {/* Fake rows */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0">
            <div className="h-4 bg-slate-200 rounded" style={{ width: 140 }} />
            <div className="h-4 bg-slate-100 rounded" style={{ width: 96 }} />
            <div className="h-5 bg-slate-200 rounded-badge" style={{ width: 36 }} />
            <div className="h-5 bg-slate-100 rounded-badge" style={{ width: 28 }} />
            <div className="h-3 bg-slate-100 rounded" style={{ width: 64 }} />
            <div className="h-3 bg-slate-100 rounded" style={{ width: 40 }} />
          </div>
        ))}
      </div>

      {/* Mobile card skeleton — visible below md */}
      <div className="grid gap-3 md:hidden animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-2/5" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
              <div className="h-5 bg-slate-200 rounded-badge w-8 flex-shrink-0" />
            </div>
            <div className="h-3 bg-slate-100 rounded w-1/4" />
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <div className="h-3 bg-slate-100 rounded w-20" />
              <div className="flex gap-2">
                <div className="h-7 bg-slate-200 rounded-lg w-12" />
                <div className="h-7 bg-slate-200 rounded-lg w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PatientList() {
  const { patients, loading, error, removePatient } = usePatients()
  const { toast } = useToast()
  const searchId = useId()

  // Surface any IndexedDB load failure via toast — rules.md §5
  useEffect(() => {
    if (error) toast({ message: `Could not load records: ${error}`, type: 'error' })
  }, [error, toast])

  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Client-side filter — no new DB queries
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(p => p.name.toLowerCase().includes(q))
  }, [patients, query])

  function handleDeleteRequest(patient: Patient) {
    setPendingDelete(patient)
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await removePatient(pendingDelete.id)
      toast({ message: 'Patient removed', type: 'success' })
    } catch {
      toast({ message: 'Failed to delete patient — please try again', type: 'error' })
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  function handleDeleteCancel() {
    if (!deleting) setPendingDelete(null)
  }

  return (
    <>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Patients</h1>
            {!loading && (
              <p className="text-sm text-slate-400 mt-0.5">
                {patients.length === 0
                  ? 'No records'
                  : `${patients.length} ${patients.length === 1 ? 'patient' : 'patients'} on this device`}
              </p>
            )}
          </div>
          <Link
            to="/patients/new"
            className="btn-primary self-start sm:self-auto flex-shrink-0"
            id="add-patient-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0
                   11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Patient
          </Link>
        </div>

        {/* Search */}
        {!loading && patients.length > 0 && (
          <div className="mb-5">
            <label htmlFor={searchId} className="sr-only">
              Search patients
            </label>
            <div className="relative max-w-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89
                     3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6
                     6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                id={searchId}
                type="search"
                placeholder="Search by name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="form-input pl-9"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : patients.length === 0 ? (
          <EmptyState hasSearch={false} />
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={true} />
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden md:block card p-0 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name', 'Date of Birth', 'Blood Type', 'Allergies', 'Last Updated', ''].map(
                      (col, i) => (
                        <th
                          key={i}
                          className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(p => (
                    <PatientRow key={p.id} patient={p} onDeleteRequest={handleDeleteRequest} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — hidden on desktop */}
            <div className="grid gap-3 md:hidden">
              {filtered.map(p => (
                <PatientCard key={p.id} patient={p} onDeleteRequest={handleDeleteRequest} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirmation dialog */}
      {pendingDelete && (
        <ConfirmDialog
          patientName={pendingDelete.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  )
}

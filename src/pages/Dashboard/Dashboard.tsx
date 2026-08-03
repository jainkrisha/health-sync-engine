/**
 * Dashboard.tsx — Dashboard overview page.
 * OWNERSHIP: Person B.
 *
 * All data sourced from IndexedDB via usePatients(). No network calls.
 * Counts are derived in-component from the patient array — no extra DB queries.
 */

import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePatients } from '../../hooks/usePatients'
import { StatCard, Card } from '../../components/Card'
import { useToast } from '../../components/Toast'
import type { Patient } from '../../types/patient'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a human-readable relative time string ("just now", "3h ago", "4 days ago"). */
function relativeTime(iso: string): string {
  if (!iso) return '—'
  const diffMs  = Date.now() - new Date(iso).getTime()
  const mins    = Math.floor(diffMs / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)  return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Returns true when updatedAt is within the last 7 days. */
function updatedWithin7Days(iso: string): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card flex items-start gap-4">
            <div className="h-11 w-11 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-slate-200 rounded w-12" />
              <div className="h-3 bg-slate-100 rounded w-28" />
            </div>
          </div>
        ))}
      </div>
      {/* Recent activity skeleton */}
      <div className="card space-y-3">
        <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-40" />
              <div className="h-2.5 bg-slate-100 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Recent activity row ──────────────────────────────────────────────────────

function ActivityRow({ patient }: { patient: Patient }) {
  /** Derive initials for the avatar */
  const initials = patient.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      {/* Avatar */}
      <div
        aria-hidden="true"
        className="flex-shrink-0 h-8 w-8 rounded-full bg-medical-100 text-medical-700
                   flex items-center justify-center text-xs font-semibold select-none"
      >
        {initials}
      </div>

      {/* Name + time */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{patient.name}</p>
        <p className="text-xs text-slate-400">Updated {relativeTime(patient.updatedAt)}</p>
      </div>

      {/* Quick edit link */}
      <Link
        to={`/patients/${patient.id}/edit`}
        className="text-xs text-medical-600 hover:text-medical-800 font-medium
                   transition-colors flex-shrink-0"
        id={`dashboard-edit-${patient.id}`}
      >
        View →
      </Link>
    </li>
  )
}

// ─── Empty dashboard (no patients at all) ─────────────────────────────────────

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-full bg-medical-50 flex items-center justify-center
                   text-3xl mb-4 select-none"
      >
        🏥
      </div>
      <h2 className="text-base font-semibold text-slate-700">Welcome to HealthSync</h2>
      <p className="text-sm text-slate-400 mt-1 mb-6 max-w-xs">
        No patient records yet. Add your first patient to start tracking health data offline.
      </p>
      <Link to="/patients/new" className="btn-primary" id="dashboard-empty-add-patient">
        Add your first patient
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { patients, loading, error } = usePatients()
  const { toast } = useToast()

  // Surface any IndexedDB load failure via toast — rules.md §5
  useEffect(() => {
    if (error) toast({ message: `Could not load records: ${error}`, type: 'error' })
  }, [error, toast])

  // Derive stats — no extra DB calls, purely from the in-memory patients array
  const stats = useMemo(() => {
    const total        = patients.length
    const withAllergy  = patients.filter(p => p.allergies.length > 0).length
    const recentUpdate = patients.filter(p => updatedWithin7Days(p.updatedAt)).length

    // Last 5 sorted by updatedAt descending
    const recent = [...patients]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)

    return { total, withAllergy, recentUpdate, recent }
  }, [patients])

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            All data stored on this device — works fully offline
          </p>
        </div>

        <Link
          to="/patients/new"
          className="btn-primary self-start sm:self-auto flex-shrink-0"
          id="dashboard-add-patient"
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
          Add New Patient
        </Link>
      </div>

      {/* Content — skeleton while loading */}
      {loading ? (
        <DashboardSkeleton />
      ) : patients.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          {/* ── Summary stat cards ───────────────────────────────────── */}
          <section aria-label="Summary statistics">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon="👤"
                value={stats.total}
                label="Total Patients"
                subLabel={`on this device`}
                accent="medical"
              />
              <StatCard
                icon="⚠️"
                value={stats.withAllergy}
                label="Patients with Allergies"
                subLabel={
                  stats.total > 0
                    ? `${Math.round((stats.withAllergy / stats.total) * 100)}% of records`
                    : undefined
                }
                accent={stats.withAllergy > 0 ? 'warning' : 'teal'}
              />
              <StatCard
                icon="🕐"
                value={stats.recentUpdate}
                label="Updated in Last 7 Days"
                subLabel="records modified recently"
                accent="teal"
              />
            </div>
          </section>

          {/* ── Recent activity ──────────────────────────────────────── */}
          <section aria-label="Recent patient activity">
            <Card>
              <div className="flex items-center justify-between mb-1">
                <h2 className="section-title">Recent Activity</h2>
                <Link
                  to="/patients"
                  className="text-xs text-medical-600 hover:text-medical-800
                             font-medium transition-colors"
                  id="dashboard-view-all-patients"
                >
                  View all →
                </Link>
              </div>

              {stats.recent.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No recent activity
                </p>
              ) : (
                <ul role="list" className="mt-3">
                  {stats.recent.map(p => (
                    <ActivityRow key={p.id} patient={p} />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

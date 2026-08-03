/**
 * AppLayout — main shell: sidebar + main content area.
 * OWNERSHIP: Person A.
 */

import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { OfflineBadge } from './OfflineBadge'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard' },
  { to: '/patients',     label: 'Patients'  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-col bg-slate-900 text-slate-100">
        {/* Brand */}
        <div className="flex items-center gap-2 border-b border-slate-700 px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white text-sm font-bold">
            HS
          </span>
          <span className="text-base font-semibold tracking-tight">HealthSync</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }: { isActive: boolean }) =>
                [
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100',
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-4 py-4 space-y-2">
          <OfflineBadge />
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-slate-400">{user?.name ?? '—'}</span>
            <button
              onClick={logout}
              className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

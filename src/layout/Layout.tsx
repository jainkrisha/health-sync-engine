import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { portalForRole } from '@shared/types';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/RBAC';
import { useTheme } from '../context/ThemeContext';
import { useSyncEngine } from '../hooks/useSync';
import { Icon, type IconName } from '../components/Icon';
import { RoleBadge, initials } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SyncStatus } from './SyncStatus';
import { deviceLabel } from '../lib/deviceProfile';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  show: boolean;
}

export function Layout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const { pendingCount } = useSyncEngine();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close the mobile menu after navigating.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', show: true },
    { to: '/patients', label: 'Patients', icon: 'patients', show: true },
    { to: '/conflicts', label: 'Conflict Review', icon: 'alert', show: perms.canReviewConflicts },
    { to: '/audit', label: 'Audit Trail', icon: 'shield', show: perms.canViewAudit },
    { to: '/admin', label: 'Users & Devices', icon: 'users', show: perms.isAdmin },
  ];

  const handleLogout = () => {
    if (pendingCount > 0) setConfirmLogout(true);
    else logout();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">
        Skip to content
      </a>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 shadow-xl transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3 border-b border-slate-800 p-5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <span className="block text-lg font-bold tracking-wide text-white">HealthSync</span>
            <span className="block text-[11px] text-slate-400">
              {user && portalForRole(user.role) === 'district' ? 'District central system' : 'PHC'} · {deviceLabel}
            </span>
          </div>
          <button className="ml-auto rounded p-1 hover:bg-slate-800 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <Icon name="x" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-teal-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon name={n.icon} className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                {n.label}
              </NavLink>
            ))}
        </nav>

        <div className="space-y-3 border-t border-slate-800 p-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-slate-400">{user.facility}</p>
                <RoleBadge role={user.role} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="btn-ghost flex-1 text-slate-300 hover:bg-slate-800" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={handleLogout} className="btn-ghost flex-1 text-slate-300 hover:bg-slate-800">
              <Icon name="logout" className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
          <button className="btn-ghost -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="ml-auto">
            <SyncStatus />
          </div>
        </header>

        <main id="main" className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl fade-in" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        isOpen={confirmLogout}
        title="Unsynced changes on this device"
        message={`${pendingCount} change(s) have not reached the server yet. They stay safely on this device and will sync after the next login. Log out anyway?`}
        confirmText="Log out"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
    </div>
  );
}

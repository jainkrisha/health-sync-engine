import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { portalForRole } from '@shared/types';
import { plural } from '@shared/text';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/RBAC';
import { useTheme } from '../context/ThemeContext';
import { useSyncEngine } from '../hooks/useSync';
import { usePatients } from '../hooks/usePatients';
import { Icon, type IconName } from '../components/Icon';
import { RoleBadge, initials } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SyncStatus } from './SyncStatus';
import { ScrollProgress, BackToTop } from './ScrollAids';
import { deviceLabel } from '../lib/deviceProfile';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: IconName;
  show: boolean;
  count?: number;
}

export function Layout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const { pendingCount } = useSyncEngine();
  const { patients } = usePatients();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close the mobile menu after navigating.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  // Escape closes the drawer; the page behind it does not scroll while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);

  const reviewCount = patients.filter((p) => p.hasOpenConflicts).length;
  const allNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: 'dashboard', show: true },
    { to: '/patients', label: 'Patients', short: 'Patients', icon: 'patients', show: true },
    { to: '/conflicts', label: 'Conflict Review', short: 'Review', icon: 'alert', show: perms.canReviewConflicts, count: reviewCount },
    { to: '/audit', label: 'Audit Trail', short: 'Audit', icon: 'shield', show: perms.canViewAudit },
    { to: '/admin', label: 'Users & Devices', short: 'Users', icon: 'users', show: perms.isAdmin },
  ];
  const nav = allNav.filter((n) => n.show);

  const district = user && portalForRole(user.role) === 'district';
  const current = nav.find((n) => location.pathname.startsWith(n.to));

  const handleLogout = () => {
    if (pendingCount > 0) setConfirmLogout(true);
    else logout();
  };

  // Phones get a bottom tab bar with the most-used destinations; the rest stay in the drawer.
  const tabs = nav.slice(0, perms.canEditPatients ? 2 : 3);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast">
        Skip to content
      </a>

      {menuOpen && (
        <div className="fixed inset-0 z-drawer animate-overlay-in bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* The column keeps the dark sidebar colour the full height of long pages; the panel inside stays pinned. */}
      <div className="hidden w-64 flex-shrink-0 bg-slate-900 lg:block" aria-hidden="true" />
      <aside
        className={`fixed inset-y-0 left-0 z-drawer flex w-72 flex-col bg-slate-900 text-slate-300 shadow-pop transition-transform duration-300 ease-out
          lg:w-64 lg:translate-x-0 lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-teal-glow" />
          <div className="min-w-0">
            <span className="block text-[17px] font-bold tracking-tight text-white">HealthSync</span>
            <span className="block truncate text-[11px] font-medium text-slate-400">
              {district ? 'District central system' : 'PHC'} · {deviceLabel}
            </span>
          </div>
          <button className="btn-icon ml-auto text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="eyebrow mb-2 px-3 text-slate-500 dark:text-slate-500">Workspace</p>
          <ul className="space-y-1">
            {nav.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-teal-glow'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`
                  }
                >
                  <Icon name={n.icon} className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="flex-1">{n.label}</span>
                  {!!n.count && (
                    <span className="rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold leading-4 text-white tabular-nums">{n.count}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="m-3 rounded-xl bg-slate-800/60 p-3 ring-1 ring-inset ring-white/5">
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-white">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-slate-400">{user.facility}</p>
              </div>
            </div>
          )}
          {user && <div className="mt-2.5"><RoleBadge role={user.role} /></div>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={toggleTheme}
              className="btn-ghost btn-sm justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={handleLogout} className="btn-ghost btn-sm justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white">
              <Icon name="logout" className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-header border-b border-slate-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex min-h-16 items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
            <button className="btn-icon -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-lg lg:hidden" />
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white lg:hidden">{current?.label ?? 'HealthSync'}</span>
            <div className="ml-auto">
              <SyncStatus />
            </div>
          </div>
          <ScrollProgress />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">
          <div className="mx-auto max-w-6xl animate-fade-in" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-header border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/90"
        aria-label="Quick navigation"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {tabs.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-teal-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    <Icon name={n.icon} className="h-5 w-5" />
                    {n.short}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {perms.canEditPatients && (
            <li className="flex flex-1 justify-center">
              <NavLink
                to="/patients/new"
                className="my-1.5 flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
                aria-label="Add patient"
              >
                <span className="flex h-7 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-teal-glow transition-transform active:scale-95">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
                Add
              </NavLink>
            </li>
          )}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <Icon name="menu" className="h-5 w-5" />
              More
              {!!reviewCount && perms.canReviewConflicts && !tabs.some((t) => t.to === '/conflicts') && (
                <span className="absolute right-1/2 top-1.5 h-2 w-2 translate-x-4 rounded-full bg-orange-500" aria-label={`${reviewCount} to review`} />
              )}
            </button>
          </li>
        </ul>
      </nav>

      <BackToTop />

      <ConfirmDialog
        isOpen={confirmLogout}
        title="Unsynced changes on this device"
        message={`${plural(pendingCount, 'change')} ${pendingCount === 1 ? 'has' : 'have'} not reached the server yet. They stay safely on this device and will sync after the next login. Log out anyway?`}
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

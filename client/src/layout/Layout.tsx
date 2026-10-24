/**
 * Layout — the frame around every signed-in page, built like a public health
 * service rather than an app dashboard:
 *
 *  1. a dark green band with the service name, where you work, the language
 *     choice and sign-out;
 *  2. a row of plain text links (the whole menu, always visible; on phones it
 *     folds behind one "Menu" button);
 *  3. one line saying whether your work has reached the server;
 *  4. the page, in a single readable column.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { portalForRole, ROLE_LABELS } from '@shared/types';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/RBAC';
import { useTheme } from '../context/ThemeContext';
import { useSyncEngine } from '../hooks/useSync';
import { usePatients } from '../hooks/usePatients';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Mark } from '../components/Mark';
import { SyncStatus } from './SyncStatus';
import { deviceLabel } from '../lib/deviceProfile';
import { useI18n } from '../i18n/useI18n';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { tFacility } from '../i18n/i18n';
import { tName } from '../i18n/names';

interface NavItem {
  to: string;
  label: string;
  show: boolean;
  count?: number;
  /** Matches only this exact path, so "Patients" is not current on "Register a patient". */
  end?: boolean;
}

export function Layout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const { t, tp } = useI18n();
  const { pendingCount } = useSyncEngine();
  const { patients } = usePatients();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Fold the phone menu after moving to another page.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const reviewCount = patients.filter((p) => p.hasOpenConflicts).length;
  const district = Boolean(user && portalForRole(user.role) === 'district');
  const allNav: NavItem[] = [
    { to: '/dashboard', label: t('Home'), show: true },
    { to: '/patients', label: t('Patients'), show: true, end: true },
    { to: '/patients/new', label: t('Register a patient'), show: perms.canEditPatients },
    { to: '/conflicts', label: t('Dose reviews'), show: perms.canReviewConflicts, count: reviewCount },
    { to: '/phcs', label: t('Health centres'), show: district },
    { to: '/audit', label: t('Change history'), show: perms.canViewAudit },
    { to: '/admin', label: t('Staff and devices'), show: perms.isAdmin },
  ];
  const nav = allNav.filter((n) => n.show);

  const handleLogout = () => {
    if (pendingCount > 0) setConfirmLogout(true);
    else logout();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only bg-focus px-4 py-2 text-[#0b0c0c] underline focus:not-sr-only focus:block">
        {t('Skip to main content')}
      </a>

      <header className="bg-band text-white">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-white no-underline">
            <Mark className="h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">HealthSync</span>
          </Link>
          {user && <span className="hidden border-l border-white/40 pl-6 text-base md:inline">{tFacility(user.facility)}</span>}
          <div className="ml-auto hidden items-center gap-6 md:flex">
            <LanguageSwitch light />
            <button type="button" onClick={handleLogout} className="text-white underline underline-offset-[0.15em] hover:decoration-[3px]">
              {t('Sign out')}
            </button>
          </div>
          <button
            type="button"
            className="ml-auto flex items-center gap-2 border-2 border-white px-3 py-1 font-bold md:hidden"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {t('Menu')} <span aria-hidden="true">{menuOpen ? '▴' : '▾'}</span>
          </button>
        </div>
      </header>

      <nav id="main-nav" aria-label={t('Main navigation')} className={`border-b border-rule ${menuOpen ? 'block' : 'hidden'} md:block`}>
        <ul className="mx-auto flex max-w-page flex-col px-4 sm:px-6 md:flex-row md:flex-wrap md:gap-x-7">
          {nav.map((n) => (
            <li key={n.to} className="border-b border-rule md:border-0">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `block py-3 text-base underline-offset-[0.15em] md:border-b-[5px] md:pb-2.5 md:pt-3.5 ${
                    isActive ? 'border-band font-bold text-ink no-underline' : 'border-transparent text-link underline hover:decoration-[3px]'
                  }`
                }
              >
                {n.label}
                {!!n.count && (
                  <span className="ml-1.5 font-bold text-warn" aria-label={t('{count} waiting', { count: n.count })}>
                    ({n.count})
                  </span>
                )}
              </NavLink>
            </li>
          ))}
          {/* On phones the language and sign-out sit at the end of the menu. */}
          <li className="space-y-3 py-4 md:hidden">
            <LanguageSwitch />
            <button type="button" onClick={handleLogout} className="btn-text">
              {t('Sign out')}
            </button>
          </li>
        </ul>
      </nav>

      <SyncStatus />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-page flex-1 px-4 pb-16 pt-8 outline-none sm:px-6 sm:pt-10">
        <Outlet />
      </main>

      <footer className="border-t-[3px] border-band bg-panel">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-6 text-sm text-muted sm:px-6 md:flex-row md:items-start md:justify-between">
          {user && (
            <p>
              {t('Signed in as {name}', { name: tName(user.name) })} · {t(ROLE_LABELS[user.role])} · {tFacility(user.facility)}
              <br />
              {t(deviceLabel)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={toggleTheme} className="link" aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? t('Use a light screen') : t('Use a dark screen')}
            </button>
            <span>HealthSync · {district ? t('District hospital') : t('Primary Health Centre')}</span>
          </div>
        </div>
      </footer>

      <ConfirmDialog
        isOpen={confirmLogout}
        title={t('Some changes are not sent yet')}
        message={tp(
          pendingCount,
          '{count} change is saved only on this device. It is safe here and will be sent after you sign in again. Sign out anyway?',
          '{count} changes are saved only on this device. They are safe here and will be sent after you sign in again. Sign out anyway?',
        )}
        confirmText={t('Sign out')}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
    </div>
  );
}

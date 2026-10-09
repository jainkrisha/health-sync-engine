import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { portalForRole } from '@shared/types';
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
import { NavWheel, type WheelItem } from './NavWheel';
import { useI18n } from '../i18n/useI18n';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { LANG_NAMES, tFacility } from '../i18n/i18n';
import { tName } from '../i18n/names';

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
  const { t, tp, lang, setLang } = useI18n();
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
    { to: '/dashboard', label: t('Dashboard'), short: t('Home'), icon: 'dashboard', show: true },
    { to: '/patients', label: t('Patients'), short: t('Patients'), icon: 'patients', show: true },
    { to: '/phcs', label: t('PHC library'), short: t('PHCs'), icon: 'clinic', show: Boolean(user && portalForRole(user.role) === 'district') },
    { to: '/conflicts', label: t('Conflict Review'), short: t('Review'), icon: 'alert', show: perms.canReviewConflicts, count: reviewCount },
    { to: '/audit', label: t('Audit Trail'), short: t('Audit'), icon: 'shield', show: perms.canViewAudit },
    { to: '/admin', label: t('Users & Devices'), short: t('Users'), icon: 'users', show: perms.isAdmin },
  ];
  const nav = allNav.filter((n) => n.show);

  const district = user && portalForRole(user.role) === 'district';

  // Desktop: the card wheel. Each card says what is behind it in one line.
  const LINES: Record<string, { line: string; color: string }> = {
    '/dashboard': { line: t("Today's numbers, sync activity and recent patients"), color: '#2b3d55' },
    '/patients': { line: t('Every record on this device, searchable'), color: '#9a4022' },
    '/patients/new': { line: t('Register a new patient, saved here first'), color: '#c4612f' },
    '/phcs': { line: t('Each PHC as a register on the shelf'), color: '#4a7562' },
    '/conflicts': { line: t('Dose clashes waiting for a clinician'), color: '#7a3b3b' },
    '/audit': { line: t('Every merge decision, append-only'), color: '#5c4a24' },
    '/admin': { line: t('Roles, accounts and syncing devices'), color: '#3a4b5e' },
  };
  const wheelItems: WheelItem[] = [
    ...nav.slice(0, 2),
    ...(perms.canEditPatients ? [{ to: '/patients/new', label: t('Add patient'), short: t('Add'), icon: 'plus' as IconName, show: true }] : []),
    ...nav.slice(2),
  ].map((n) => ({ to: n.to, label: n.label, icon: n.icon, count: n.count, line: LINES[n.to].line, color: LINES[n.to].color }));
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
        {t('Skip to content')}
      </a>

      {menuOpen && (
        <div className="fixed inset-0 z-drawer animate-overlay-in bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Phones and tablets: a slide-in drawer. Desktop uses the card wheel instead. */}
      <aside
        className={`fixed inset-y-0 left-0 z-drawer flex w-72 flex-col bg-slate-900 text-slate-300 shadow-pop transition-transform duration-300 ease-out lg:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('Main navigation')}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <img src="/logo.svg" alt="" className="h-9 w-9 rounded-xl" />
          <div className="min-w-0">
            <span className="block text-[17px] font-bold tracking-tight text-white">HealthSync</span>
            <span className="block truncate text-[11px] font-medium text-slate-400">
              {district ? t('District central system') : t('PHC')} · {t(deviceLabel)}
            </span>
          </div>
          <button className="btn-icon ml-auto text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label={t('Close menu')}>
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="eyebrow mb-2 px-3 text-slate-500 dark:text-slate-500">{t('Workspace')}</p>
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
                {initials(tName(user.name))}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{tName(user.name)}</p>
                <p className="truncate text-xs text-slate-400">{tFacility(user.facility)}</p>
              </div>
            </div>
          )}
          {user && <div className="mt-2.5"><RoleBadge role={user.role} /></div>}
          <LanguageSwitch
            className="mt-3 grid grid-cols-2 gap-2"
            buttonClassName="btn-ghost btn-sm justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white aria-pressed:bg-slate-700/70 aria-pressed:text-white"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={toggleTheme}
              className="btn-ghost btn-sm justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white"
              aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
              {theme === 'dark' ? t('Light') : t('Dark')}
            </button>
            <button onClick={handleLogout} className="btn-ghost btn-sm justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white">
              <Icon name="logout" className="h-4 w-4" />
              {t('Log out')}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-header border-b border-slate-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex min-h-16 items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
            <button className="btn-icon -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label={t('Open menu')} aria-expanded={menuOpen}>
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <img src="/logo.svg" alt="" className="h-7 w-7 rounded-lg lg:h-8 lg:w-8" />
            <span className="hidden flex-col leading-tight lg:flex">
              <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">HealthSync</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{district ? t('District central system') : t('PHC')} · {t(deviceLabel)}</span>
            </span>
            <span className="hidden h-6 w-px bg-slate-200 lg:mx-3 lg:block dark:bg-slate-700" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{current?.label ?? 'HealthSync'}</span>
            <div className="ml-auto flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
                className="btn-icon text-xs font-bold"
                lang={lang === 'hi' ? 'en' : 'hi'}
                aria-label={t('Switch to {language}', { language: LANG_NAMES[lang === 'hi' ? 'en' : 'hi'] })}
                data-tip={LANG_NAMES[lang === 'hi' ? 'en' : 'hi']}
              >
                {lang === 'hi' ? 'EN' : 'हि'}
              </button>
              <SyncStatus />
              {user && (
                <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 lg:flex dark:border-slate-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-[11px] font-bold text-white" aria-hidden="true">
                    {initials(tName(user.name))}
                  </span>
                  <span className="hidden min-w-0 flex-col leading-tight xl:flex">
                    <span className="max-w-[11rem] truncate text-xs font-semibold text-slate-900 dark:text-white">{tName(user.name)}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{tFacility(user.facility)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="btn-icon"
                    aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
                    data-tip={theme === 'dark' ? t('Light mode') : t('Dark mode')}
                  >
                    <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={handleLogout} className="btn-icon" aria-label={t('Log out')} data-tip={t('Log out')} data-tip-pos="left">
                    <Icon name="logout" className="h-4 w-4" />
                  </button>
                </div>
              )}
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
        aria-label={t('Quick navigation')}
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
                aria-label={t('Add patient')}
              >
                <span className="flex h-7 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-teal-glow transition-transform active:scale-95">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
                {t('Add')}
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
              {t('More')}
              {!!reviewCount && perms.canReviewConflicts && !tabs.some((t) => t.to === '/conflicts') && (
                <span className="absolute right-1/2 top-1.5 h-2 w-2 translate-x-4 rounded-full bg-orange-500" aria-label={t('{count} to review', { count: reviewCount })} />
              )}
            </button>
          </li>
        </ul>
      </nav>

      <NavWheel items={wheelItems} />

      <BackToTop />

      <ConfirmDialog
        isOpen={confirmLogout}
        title={t('Unsynced changes on this device')}
        message={tp(
          pendingCount,
          '{count} change has not reached the server yet. They stay safely on this device and will sync after the next login. Log out anyway?',
          '{count} changes have not reached the server yet. They stay safely on this device and will sync after the next login. Log out anyway?',
        )}
        confirmText={t('Log out')}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
    </div>
  );
}

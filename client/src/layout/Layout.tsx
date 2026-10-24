/**
 * Layout — the frame around every signed-in page.
 *
 * Desktop: a menu on the left that is always open, with a word beside every
 * icon. Phones and tablets: a bar at the bottom with the four most-used places
 * and a "Menu" button for the rest. The connection strip at the top says in
 * plain words whether the work is saved on the server or only on this device.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { portalForRole } from '@shared/types';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/RBAC';
import { useTheme } from '../context/ThemeContext';
import { useSyncEngine } from '../hooks/useSync';
import { usePatients } from '../hooks/usePatients';
import { Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SyncStatus } from './SyncStatus';
import { deviceLabel } from '../lib/deviceProfile';
import { useI18n } from '../i18n/useI18n';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { tFacility } from '../i18n/i18n';
import { tName } from '../i18n/names';
import { ROLE_LABELS } from '@shared/types';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  show: boolean;
  count?: number;
  /** Matches only this exact path (so "Patients" is not active on "Add patient"). */
  end?: boolean;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-1">
      {items.map((n) => (
        <li key={n.to}>
          <NavLink
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-[3rem] items-center gap-3 rounded-lg border-l-[5px] px-3 py-2 text-base font-semibold ${
                isActive
                  ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-300 dark:bg-brand-950 dark:text-white'
                  : 'border-transparent text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon name={n.icon} className="h-6 w-6 flex-shrink-0" />
            <span className="flex-1">{n.label}</span>
            {!!n.count && (
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300" aria-label={t('{count} waiting', { count: n.count })}>
                {n.count}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function AccountPanel({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  if (!user) return null;
  return (
    <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <Avatar name={tName(user.name)} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900 dark:text-white">{tName(user.name)}</p>
          <p className="truncate text-sm text-slate-700 dark:text-slate-300">
            {t(ROLE_LABELS[user.role])} · {tFacility(user.facility)}
          </p>
          <p className="truncate text-sm text-slate-700 dark:text-slate-300">{t(deviceLabel)}</p>
        </div>
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Icon name="globe" className="h-4 w-4" /> {t('Language')}
        </p>
        <LanguageSwitch className="grid grid-cols-2 gap-2" buttonClassName="segmented-item justify-center" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={toggleTheme} className="btn-plain btn-sm" aria-pressed={theme === 'dark'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
          {theme === 'dark' ? t('Light screen') : t('Dark screen')}
        </button>
        <button type="button" onClick={onSignOut} className="btn-plain btn-sm">
          <Icon name="logout" className="h-5 w-5" />
          {t('Sign out')}
        </button>
      </div>
    </div>
  );
}

function Brand() {
  const { user } = useAuth();
  const { t } = useI18n();
  const district = user && portalForRole(user.role) === 'district';
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.svg" alt="" className="h-10 w-10 flex-shrink-0" />
      <div className="min-w-0 leading-tight">
        <span className="block text-lg font-bold text-slate-900 dark:text-white">HealthSync</span>
        <span className="block truncate text-sm text-slate-700 dark:text-slate-300">{district ? t('District hospital') : t('Health centre (PHC)')}</span>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const { t, tp } = useI18n();
  const { pendingCount } = useSyncEngine();
  const { patients } = usePatients();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close the phone menu after moving to another page.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  // Escape closes the menu; the page behind it does not scroll while it is open.
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
  const district = Boolean(user && portalForRole(user.role) === 'district');
  const allNav: NavItem[] = [
    { to: '/dashboard', label: t('Home'), icon: 'home', show: true },
    { to: '/patients', label: t('Patients'), icon: 'patients', show: true, end: true },
    { to: '/patients/new', label: t('Add patient'), icon: 'plus', show: perms.canEditPatients },
    { to: '/conflicts', label: t('Dose reviews'), icon: 'pill', show: perms.canReviewConflicts, count: reviewCount },
    { to: '/phcs', label: t('Health centres'), icon: 'clinic', show: district },
    { to: '/audit', label: t('Change history'), icon: 'shield', show: perms.canViewAudit },
    { to: '/admin', label: t('Staff and devices'), icon: 'users', show: perms.isAdmin },
  ];
  const nav = allNav.filter((n) => n.show);

  // Phones: the first three places plus "Menu" in the bottom bar.
  const tabs = nav.slice(0, 3);

  const handleLogout = () => {
    if (pendingCount > 0) setConfirmLogout(true);
    else logout();
  };

  return (
    <div className="min-h-screen">
      <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast">
        {t('Skip to content')}
      </a>

      {/* Desktop menu: always open. */}
      <aside className="fixed inset-y-0 left-0 z-drawer hidden w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <Brand />
        <nav className="mt-6 flex-1 overflow-y-auto" aria-label={t('Main navigation')}>
          <NavList items={nav} />
        </nav>
        <AccountPanel onSignOut={handleLogout} />
      </aside>

      {/* Phone and tablet menu. */}
      {menuOpen && (
        <div className="fixed inset-0 z-drawer lg:hidden" role="dialog" aria-modal="true" aria-label={t('Menu')}>
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,100%)] flex-col overflow-y-auto bg-white px-4 py-4 shadow-pop dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Brand />
              <button type="button" className="btn-plain btn-sm flex-shrink-0" onClick={() => setMenuOpen(false)}>
                <Icon name="x" className="h-5 w-5" /> {t('Close')}
              </button>
            </div>
            <nav className="flex-1" aria-label={t('Main navigation')}>
              <NavList items={nav} onNavigate={() => setMenuOpen(false)} />
            </nav>
            <div className="mt-6">
              <AccountPanel onSignOut={handleLogout} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-72">
        <header className="sticky top-0 z-header border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 px-4 py-2 sm:px-6 lg:hidden">
            <Brand />
            <button type="button" className="btn-plain btn-sm ml-auto flex-shrink-0" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}>
              <Icon name="menu" className="h-5 w-5" /> {t('Menu')}
            </button>
          </div>
          <SyncStatus />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-32 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone and tablet bottom bar: icon and word on every button. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-header border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-slate-700 dark:bg-slate-900"
        aria-label={t('Quick links')}
      >
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {tabs.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex min-h-[4rem] flex-col items-center justify-center gap-1 border-t-4 px-1 text-sm font-semibold ${
                    isActive ? 'border-brand-600 text-brand-800 dark:border-brand-300 dark:text-brand-200' : 'border-transparent text-slate-700 dark:text-slate-200'
                  }`
                }
              >
                <span className="relative">
                  <Icon name={n.icon} className="h-6 w-6" />
                  {!!n.count && <span className="absolute -right-3 -top-1 text-xs font-bold text-amber-800 dark:text-amber-300">{n.count}</span>}
                </span>
                <span className="text-center leading-tight">{n.label}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex min-h-[4rem] w-full flex-col items-center justify-center gap-1 border-t-4 border-transparent px-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              <Icon name="menu" className="h-6 w-6" />
              {t('Menu')}
            </button>
          </li>
        </ul>
      </nav>

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

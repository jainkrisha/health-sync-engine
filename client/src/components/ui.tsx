/** Small presentational building blocks shared by every page. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatClock, type VectorClock } from '@shared/vectorClock';
import { ROLE_LABELS, type Role } from '@shared/types';
import { Icon, type IconName } from './Icon';
import { useI18n } from '../i18n/useI18n';
import { dateLocale, t } from '../i18n/i18n';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** "Back" link shown above the title, e.g. { to: '/patients', label: 'Patients' }. */
  back?: { to: string; label: string };
}) {
  useI18n();
  return (
    <header className="mb-6 sm:mb-8">
      {back && (
        <Link to={back.to} className="link mb-4 inline-flex min-h-[2.75rem] items-center gap-1.5 no-underline hover:underline">
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
          {t('Back to {label}', { label: back.label })}
        </Link>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact = false,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  /** Kept for callers; every empty state now uses the same calm style. */
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12 sm:py-16'}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {message && <p className="mt-1.5 max-w-md text-base text-slate-700 dark:text-slate-300">{message}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-[3px] border-current border-t-transparent ${className}`} aria-hidden="true" />;
}

/** A visible "Loading…" line, so people know the app is working. */
export function Loading({ label }: { label?: string }) {
  useI18n();
  return (
    <p className="flex items-center gap-3 py-6 text-base font-semibold text-slate-700 dark:text-slate-200" role="status">
      <Spinner /> {label ?? t('Loading…')}
    </p>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  useI18n();
  return (
    <div aria-busy="true">
      <Loading />
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="card flex items-center gap-4 py-4 sm:py-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A problem, said plainly, with an optional retry. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useI18n();
  return (
    <div role="alert" className="notice-danger">
      <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <p className="flex-1">{t(message)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-bold underline underline-offset-4">
          {t('Try again')}
        </button>
      )}
    </div>
  );
}

export function OfflineNotice({ message }: { message: string }) {
  return (
    <div className="notice-warning" role="note">
      <Icon name="wifiOff" className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <p>{message}</p>
    </div>
  );
}

/** Card heading: an icon and a plain title, with an optional slot on the right. */
export function SectionHeading({ id, icon, children, aside }: { id?: string; icon?: IconName; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id={id} className="section-title flex items-center gap-2.5">
        {icon && <Icon name={icon} className="h-6 w-6 flex-shrink-0 text-brand-700 dark:text-brand-300" />}
        {children}
      </h2>
      {aside && <div className="text-sm text-slate-600 dark:text-slate-300">{aside}</div>}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  useI18n();
  return <span className="badge-muted">{t(ROLE_LABELS[role])}</span>;
}

/** Readable vector clock: one entry per device counter. Shown only in technical details. */
export function ClockView({ clock, highlight }: { clock: VectorClock; highlight?: string }) {
  const entries = Object.entries(clock).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span className="text-sm text-slate-500">∅</span>;
  return (
    <span className="inline-flex flex-wrap gap-1" title={formatClock(clock)}>
      {entries.map(([id, v]) => (
        <span
          key={id}
          className={`rounded px-1.5 py-0.5 font-mono text-xs ${
            id === highlight ? 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          {shortId(id)}:{v}
        </span>
      ))}
    </span>
  );
}

export function shortId(id: string): string {
  if (id === 'server' || id.length <= 8) return id;
  if (/^[0-9a-f]{8}-/.test(id)) return id.slice(0, 6);
  return `${id.slice(0, 4)}…${id.slice(-3)}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return t('never');
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{count}m ago', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('{count}h ago', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? t('{count} day ago', { count: days }) : t('{count} days ago', { count: days });
  return new Date(iso).toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(dateLocale(), { dateStyle: 'medium' });
}

export function ageFrom(dob: string): string {
  if (!dob) return '';
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return t('{count} yrs', { count: age });
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** Round letter badge for a person; decorative, the name is always shown beside it. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-900 dark:bg-brand-900 dark:text-brand-100 ${
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

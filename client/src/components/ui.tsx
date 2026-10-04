/** Small presentational building blocks shared by every page. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatClock, type VectorClock } from '@shared/vectorClock';
import { ROLE_LABELS, type Role } from '@shared/types';
import { Icon, type IconName } from './Icon';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Optional "back" link shown above the title, e.g. { to: '/patients', label: 'Patients' }. */
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-slate-200/80 pb-5 sm:mb-8 sm:pb-6 dark:border-slate-800">
      {back && (
        <Link
          to={back.to}
          aria-label={`Back to ${back.label}`}
          className="group mb-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-500 transition-colors hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  tone = 'teal',
  compact = false,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  tone?: 'teal' | 'rose' | 'slate';
  compact?: boolean;
}) {
  const toneClass = {
    teal: 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-800/50',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50',
    slate: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  }[tone];
  return (
    <div className={`fade-in flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-14 sm:py-20'}`}>
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-8 ${toneClass}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-4 py-4 sm:py-4" style={{ opacity: 1 - i * 0.12 }}>
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton hidden h-7 w-16 rounded-lg sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Inline problem banner with an optional retry action. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
      <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline-offset-4 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** Card section heading: small label with an optional icon and a right-aligned slot. */
export function SectionHeading({ id, icon, children, aside }: { id?: string; icon?: IconName; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="section-title flex items-center gap-2">
        {icon && <Icon name={icon} className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const style: Record<Role, string> = {
    admin: 'badge-violet',
    clinical_reviewer: 'badge-blue',
    health_worker: 'badge-teal',
    auditor: 'badge-warning',
  };
  return <span className={style[role]}>{ROLE_LABELS[role]}</span>;
}

/** Readable vector clock: one chip per device counter. */
export function ClockView({ clock, highlight }: { clock: VectorClock; highlight?: string }) {
  const entries = Object.entries(clock).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span className="text-xs text-slate-400">∅</span>;
  return (
    <span className="inline-flex flex-wrap gap-1" title={formatClock(clock)}>
      {entries.map(([id, v]) => (
        <span
          key={id}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
            id === highlight
              ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
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
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function ageFrom(dob: string): string {
  if (!dob) return '';
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
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

export function OfflineNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
        <Icon name="wifiOff" className="h-4 w-4" />
      </span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

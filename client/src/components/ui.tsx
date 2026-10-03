/** Small presentational building blocks shared by every page. */
import type { ReactNode } from 'react';
import { formatClock, type VectorClock } from '@shared/vectorClock';
import { ROLE_LABELS, type Role } from '@shared/types';
import { Icon, type IconName } from './Icon';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center fade-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
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
        <div key={i} className="card flex items-center gap-4 py-4">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
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
    <div className="card flex items-center gap-3 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <Icon name="wifiOff" className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

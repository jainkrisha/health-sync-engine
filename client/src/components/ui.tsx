/** Small building blocks shared by every page. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatClock, type VectorClock } from '@shared/vectorClock';
import { ROLE_LABELS, type Role } from '@shared/types';
import { useI18n } from '../i18n/useI18n';
import { dateLocale, t } from '../i18n/i18n';

/** "Back" link above the page title. */
export function BackLink({ to, label }: { to: string; label: string }) {
  useI18n();
  return (
    <Link to={to} className="link mb-6 inline-flex items-center gap-1.5 text-base">
      <span aria-hidden="true">‹</span> {t('Back to {label}', { label })}
    </Link>
  );
}

/**
 * Page heading: a grey caption saying where you are (the facility, or the
 * patient), the title, and one sentence on what the page is for.
 */
export function PageHeader({
  caption,
  title,
  lead,
  back,
  actions,
}: {
  caption?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && <BackLink {...back} />}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-[40rem]">
          {caption && <span className="caption">{caption}</span>}
          <h1 className="heading-xl">{title}</h1>
          {lead && <p className="lead mt-4 text-ink">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
      </div>
    </header>
  );
}

/** Nothing to show yet: a heading, a sentence and what to do. No illustration. */
export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="border-y border-rule py-6">
      <h2 className="heading-m">{title}</h2>
      {message && <p className="mt-2 max-w-[40rem]">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-[1em] w-[1em]' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />;
}

/** A visible "Loading…" line, so people know the app is working. */
export function Loading({ label }: { label?: string }) {
  useI18n();
  return (
    <p className="flex items-center gap-3 py-4 text-muted" role="status">
      <Spinner /> {label ?? t('Loading…')}
    </p>
  );
}

/** A problem, said plainly, with an optional retry. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useI18n();
  return (
    <div role="alert" className="error-summary">
      <h2 className="heading-m">{t('There is a problem')}</h2>
      <p className="mt-2">{t(message)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-text mt-3">
          {t('Try again')}
        </button>
      )}
    </div>
  );
}

/** Shown where a page needs the internet. */
export function OfflineNotice({ message }: { message: string }) {
  return (
    <div className="inset" role="note">
      <p className="font-bold">{message}</p>
    </div>
  );
}

/** Section heading: a plain bold title; sections are separated by a rule, not boxed. */
export function SectionHeading({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="heading-l">
        {children}
      </h2>
      {aside && <div className="text-muted">{aside}</div>}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  useI18n();
  return <span>{t(ROLE_LABELS[role])}</span>;
}

/** Readable vector clock, one entry per device. Shown only in technical details. */
export function ClockView({ clock, highlight }: { clock: VectorClock; highlight?: string }) {
  const entries = Object.entries(clock).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span className="text-muted">∅</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3 font-mono text-sm" title={formatClock(clock)}>
      {entries.map(([id, v]) => (
        <span key={id} className={id === highlight ? 'font-semibold underline' : undefined}>
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

/** Short record number shown on the patient banner: the first 8 characters of the id, in groups of 4. */
export function recordNumber(id: string): string {
  const s = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${s.slice(0, 4)} ${s.slice(4)}`;
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
  return new Date(iso).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
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

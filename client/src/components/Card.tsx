/**
 * Card.tsx — Reusable card components for the medical UI.
 *
 * Exports:
 *   <Card>          — generic white rounded container (mirrors .card CSS class but as a component)
 *   <StatCard>      — summary metric card: icon + value + label + optional sub-label (and optional link)
 */

import type { ReactNode, ElementType } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

// ─── Generic card wrapper ─────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  className?: string
  /** HTML element or component to render as — defaults to 'div' */
  as?: ElementType
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  /** Large numeric or text value to display prominently */
  value: string | number
  /** Descriptive label below the value */
  label: string
  /** Optional smaller text beneath the label */
  subLabel?: string
  icon: IconName
  /** Colour family — maps to Tailwind palette tokens from tailwind.config.js */
  accent?: 'medical' | 'teal' | 'warning' | 'danger'
  /** Makes the whole card a link to where the number can be acted on. */
  to?: string
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
  medical: 'bg-medical-50 text-medical-600 ring-medical-100 dark:bg-medical-900/40 dark:text-medical-300 dark:ring-medical-800/60',
  teal: 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-800/60',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/60',
  danger: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/60',
}

export function StatCard({ value, label, subLabel, icon, accent = 'medical', to }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-4 ${accentClasses[accent]}`}
          aria-hidden="true"
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
        {to && (
          <Icon
            name="arrowRight"
            className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-teal-600 dark:text-slate-600"
          />
        )}
      </div>
      <div className="mt-3 min-w-0 sm:mt-4" aria-hidden="true">
        <p className="text-2xl font-bold leading-none tracking-tight sm:text-[1.75rem] text-slate-900 tabular-nums dark:text-white">{value}</p>
        <p className="mt-2 text-[13px] font-medium leading-snug text-slate-600 sm:text-sm dark:text-slate-300">{label}</p>
        {subLabel && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{subLabel}</p>}
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="card card-interactive group block p-4 sm:p-6" aria-label={`${value} — ${label}`}>
        {body}
      </Link>
    )
  }
  return (
    <div className="card p-4 sm:p-6" role="group" aria-label={`${value} — ${label}`}>
      {body}
    </div>
  )
}

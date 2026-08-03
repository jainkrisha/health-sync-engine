/**
 * Card.tsx — Reusable card components for the medical UI.
 * OWNERSHIP: Person B (shared — any teammate may import, never modify without flagging).
 *
 * Exports:
 *   <Card>          — generic white rounded container (mirrors .card CSS class but as a component)
 *   <StatCard>      — summary metric card: icon + label + value + optional sub-label
 *
 * No network calls. No side effects.
 */

import type { ReactNode, ElementType } from 'react'

// ─── Generic card wrapper ─────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  className?: string
  /** HTML element or component to render as — defaults to 'div' */
  as?: ElementType
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={`card ${className}`}>
      {children}
    </Tag>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  /** Large numeric or text value to display prominently */
  value: string | number
  /** Descriptive label below the value */
  label: string
  /** Optional smaller text beneath the label */
  subLabel?: string
  /** Emoji or single-character icon shown in the coloured circle */
  icon: string
  /** Colour family — maps to Tailwind palette tokens from tailwind.config.js */
  accent?: 'medical' | 'teal' | 'warning' | 'danger'
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, { ring: string; bg: string; text: string }> = {
  medical: {
    ring: 'ring-medical-100',
    bg:   'bg-medical-50',
    text: 'text-medical-600',
  },
  teal: {
    ring: 'ring-teal-100',
    bg:   'bg-teal-50',
    text: 'text-teal-600',
  },
  warning: {
    ring: 'ring-amber-100',
    bg:   'bg-amber-50',
    text: 'text-amber-600',
  },
  danger: {
    ring: 'ring-red-100',
    bg:   'bg-red-50',
    text: 'text-red-500',
  },
}

export function StatCard({
  value,
  label,
  subLabel,
  icon,
  accent = 'medical',
}: StatCardProps) {
  const a = accentClasses[accent]

  return (
    <div
      className="card flex items-start gap-4"
      aria-label={`${value} — ${label}`}
    >
      {/* Icon circle */}
      <div
        className={`
          flex-shrink-0 h-11 w-11 rounded-full ring-2 flex items-center
          justify-center text-xl select-none
          ${a.ring} ${a.bg} ${a.text}
        `}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Text — aria-hidden because the container label covers it */}
      <div className="min-w-0" aria-hidden="true">
        <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
          {value}
        </p>
        <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
        {subLabel && (
          <p className="text-xs text-slate-400 mt-0.5">{subLabel}</p>
        )}
      </div>
    </div>
  )
}

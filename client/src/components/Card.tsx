/**
 * Card.tsx — the white panel every page is built from, and the number tile
 * used on the home page.
 */
import type { ReactNode, ElementType } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

interface CardProps {
  children: ReactNode
  className?: string
  /** HTML element or component to render as — defaults to 'div' */
  as?: ElementType
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

interface StatCardProps {
  value: string | number
  label: string
  /** A short sentence under the label: what the number means or what to do. */
  subLabel?: string
  icon: IconName
  /** ok: nothing to do; warning: something is waiting; danger: needs a person now. */
  tone?: 'neutral' | 'ok' | 'warning' | 'danger'
  /** Makes the tile a link to where the number can be acted on. */
  to?: string
  /** The link's words, e.g. "See patients". */
  action?: string
}

const toneEdge: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'border-l-brand-600 dark:border-l-brand-400',
  ok: 'border-l-green-700 dark:border-l-green-400',
  warning: 'border-l-amber-600 dark:border-l-amber-400',
  danger: 'border-l-red-700 dark:border-l-red-400',
}

export function StatCard({ value, label, subLabel, icon, tone = 'neutral', to, action }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Icon name={icon} className="h-6 w-6 flex-shrink-0 text-slate-600 dark:text-slate-300" />
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{label}</p>
      </div>
      <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {subLabel && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{subLabel}</p>}
      {to && action && (
        <span className="mt-3 inline-flex items-center gap-1.5 font-semibold text-brand-700 underline underline-offset-4 group-hover:decoration-2 dark:text-brand-300">
          {action} <Icon name="arrowRight" className="h-4 w-4" />
        </span>
      )}
    </>
  )
  const className = `card block border-l-[6px] p-5 sm:p-5 ${toneEdge[tone]}`
  if (to) {
    return (
      <Link to={to} className={`${className} group hover:bg-slate-50 dark:hover:bg-slate-800/60`}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}

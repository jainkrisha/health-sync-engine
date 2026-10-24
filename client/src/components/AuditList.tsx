import type { AuditEntry } from '@shared/types';
import { FIELD_LABELS } from '@shared/mergeEngine';
import { formatDateTime, shortId } from './ui';
import { OUTCOME_LABEL, OUTCOME_STYLE, RULE_LABEL } from './auditLabels';
import { useI18n } from '../i18n/useI18n';
import { translateReport } from '../i18n/reports';
import { tName } from '../i18n/names';

export function AuditList({
  entries,
  showPatient = true,
}: {
  entries: AuditEntry[];
  showPatient?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ol className="relative ml-1.5 space-y-6 border-l-2 border-slate-300 pl-6 dark:border-slate-700">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-[33px] top-1.5 h-4 w-4 rounded-full ring-4 ring-white dark:ring-slate-900 ${
              e.resolutionType === 'manual'
                ? 'bg-brand-700'
                : e.outcome === 'conflict'
                  ? 'bg-amber-600'
                  : e.concurrent
                    ? 'bg-brand-500'
                    : 'bg-green-700'
            }`}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <time className="font-semibold text-slate-700 dark:text-slate-300" dateTime={e.timestamp}>
              {formatDateTime(e.timestamp)}
            </time>
            {showPatient && (
              <span className="font-bold text-slate-900 dark:text-white">
                {tName(e.patientName) || t('Unnamed patient')}
              </span>
            )}
            <span className="badge-muted">{t(FIELD_LABELS[e.field] ?? e.field)}</span>
            <span className={OUTCOME_STYLE[e.outcome] ?? 'badge-muted'}>
              {t(OUTCOME_LABEL[e.outcome] ?? e.outcome)}
            </span>
            <span className="text-slate-700 dark:text-slate-300">{t(RULE_LABEL[e.rule] ?? e.rule)}</span>
            {e.concurrent && <span className="badge-info">{t('Concurrent edit')}</span>}
          </div>
          <p className="mt-1.5 text-base text-slate-900 dark:text-slate-100">{translateReport(e.report)}</p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            {e.resolutionType === 'manual'
              ? t('Manual review by {name}', { name: tName(e.resolvedByName) ?? t('reviewer') })
              : `${t('Automatic')}${e.clientId ? ` · ${t('from device {id}', { id: shortId(e.clientId) })}` : ''}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

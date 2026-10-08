import type { AuditEntry } from '@shared/types';
import { FIELD_LABELS } from '@shared/mergeEngine';
import { formatDateTime, shortId } from './ui';
import { OUTCOME_LABEL, OUTCOME_STYLE, RULE_LABEL } from './auditLabels';
import { useI18n } from '../i18n/useI18n';
import { translateReport } from '../i18n/reports';

export function AuditList({
  entries,
  showPatient = true,
}: {
  entries: AuditEntry[];
  showPatient?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ol className="relative ml-1.5 space-y-5 border-l border-slate-200 pl-6 dark:border-slate-700">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${
              e.resolutionType === 'manual'
                ? 'bg-medical-700'
                : e.outcome === 'conflict'
                  ? 'bg-orange-500'
                  : e.concurrent
                    ? 'bg-medical-500'
                    : 'bg-sage-500'
            }`}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <time className="font-medium text-slate-500 dark:text-slate-400" dateTime={e.timestamp}>
              {formatDateTime(e.timestamp)}
            </time>
            {showPatient && (
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {e.patientName || t('Unnamed patient')}
              </span>
            )}
            <span className="badge-slate">{t(FIELD_LABELS[e.field] ?? e.field)}</span>
            <span className={OUTCOME_STYLE[e.outcome] ?? 'badge-slate'}>
              {t(OUTCOME_LABEL[e.outcome] ?? e.outcome)}
            </span>
            <span className="text-slate-400">{t(RULE_LABEL[e.rule] ?? e.rule)}</span>
            {e.concurrent && <span className="badge-blue">{t('Concurrent edit')}</span>}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-800 dark:text-slate-200">{translateReport(e.report)}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {e.resolutionType === 'manual'
              ? t('Manual review by {name}', { name: e.resolvedByName ?? t('reviewer') })
              : `${t('Automatic')}${e.clientId ? ` · ${t('from device {id}', { id: shortId(e.clientId) })}` : ''}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

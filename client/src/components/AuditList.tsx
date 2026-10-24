import type { AuditEntry } from '@shared/types';
import { FIELD_LABELS } from '@shared/mergeEngine';
import { formatDateTime, shortId } from './ui';
import { OUTCOME_LABEL, OUTCOME_STYLE, RULE_LABEL } from './auditLabels';
import { useI18n } from '../i18n/useI18n';
import { translateReport } from '../i18n/reports';
import { tName } from '../i18n/names';

/**
 * The change history as a ledger: when on the left, then what changed, what
 * the system did and why, and who or which device did it.
 */
export function AuditList({ entries, showPatient = true }: { entries: AuditEntry[]; showPatient?: boolean }) {
  const { t } = useI18n();
  return (
    <ol className="border-t border-rule">
      {entries.map((e) => (
        <li key={e.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-3 sm:grid-cols-[11rem_1fr]">
          <time className="text-sm text-muted sm:pt-0.5" dateTime={e.timestamp}>
            {formatDateTime(e.timestamp)}
          </time>
          <div>
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {showPatient && <span className="font-bold">{tName(e.patientName) || t('Unnamed patient')}</span>}
              <span>{t(FIELD_LABELS[e.field] ?? e.field)}</span>
              <span className={`${OUTCOME_STYLE[e.outcome] ?? 'status-muted'} text-sm`}>{t(OUTCOME_LABEL[e.outcome] ?? e.outcome)}</span>
            </p>
            <p className="mt-1">{translateReport(e.report)}</p>
            <p className="mt-0.5 text-sm text-muted">
              {t(RULE_LABEL[e.rule] ?? e.rule)}
              {e.concurrent && ` · ${t('Made at the same time on two devices')}`}
              {' · '}
              {e.resolutionType === 'manual'
                ? t('Manual review by {name}', { name: tName(e.resolvedByName) ?? t('reviewer') })
                : `${t('Automatic')}${e.clientId ? ` · ${t('from device {id}', { id: shortId(e.clientId) })}` : ''}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

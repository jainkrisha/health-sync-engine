/**
 * ExportPanel — "Download …" that opens to a short form: which patients, which
 * file type, one button. The file is made on this device, so it works offline.
 */
import { useId, useState } from 'react';
import type { Patient } from '@shared/types';
import { downloadExport, type ExportFormat } from '../lib/exportPatients';
import { useToast } from './Toast';
import { useI18n } from '../i18n/useI18n';

export function ExportPanel({ all, shown, summary }: { all: Patient[]; shown?: Patient[]; summary: string }) {
  const { t, tp } = useI18n();
  const { toast } = useToast();
  const [scope, setScope] = useState<'shown' | 'all'>('shown');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const id = useId();
  const filtered = shown && shown.length !== all.length;
  const chosen = filtered && scope === 'shown' ? shown : all;

  const save = () => {
    try {
      const name = downloadExport(chosen, format);
      toast({ message: t('Downloaded {file}', { file: name }), type: 'success' });
    } catch (err) {
      toast({ message: `${t('Could not make the file:')} ${err instanceof Error ? err.message : ''}`, type: 'error' });
    }
  };

  return (
    <details className="details">
      <summary>{summary}</summary>
      <div className="details-body space-y-5">
        {filtered && (
          <fieldset>
            <legend className="form-label">{t('Which patients?')}</legend>
            <div className="radios">
              {(['shown', 'all'] as const).map((s) => (
                <label key={s} className="radio">
                  <input type="radio" name={`${id}-scope`} checked={scope === s} onChange={() => setScope(s)} />
                  <span className="radio-label">
                    {s === 'shown'
                      ? tp(shown!.length, 'Only the {count} patient shown', 'Only the {count} patients shown')
                      : tp(all.length, 'All {count} patient', 'All {count} patients')}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend className="form-label">{t('File type')}</legend>
          <div className="radios">
            {(
              [
                ['xlsx', 'Excel file (.xlsx)', 'One sheet each for patients, allergies, medicines and check-ups.'],
                ['csv', 'CSV file (.csv)', 'One row per patient. Opens in any spreadsheet program.'],
              ] as const
            ).map(([f, label, hint]) => (
              <label key={f} className="radio">
                <input type="radio" name={`${id}-format`} checked={format === f} onChange={() => setFormat(f)} />
                <span className="radio-label">
                  <span className="block font-bold">{t(label)}</span>
                  <span className="block text-muted">{t(hint)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="warning">
          <span className="warning-mark" aria-hidden="true">
            !
          </span>
          <span>
            <span className="sr-only">{t('Warning')}: </span>
            {t('The downloaded file is not locked. Keep it private and delete it when you no longer need it.')}
          </span>
        </p>
        <button type="button" className="btn-secondary" onClick={save} disabled={chosen.length === 0}>
          {t('Download file')}
        </button>
      </div>
    </details>
  );
}

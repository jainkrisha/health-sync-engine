/**
 * ExportPanel — "Download" button that opens a short panel: which patients,
 * then Excel or CSV. The file is made on this device, so it works offline.
 */
import { useId, useState } from 'react';
import type { Patient } from '@shared/types';
import { downloadExport, type ExportFormat } from '../lib/exportPatients';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useI18n } from '../i18n/useI18n';

export function ExportPanel({ all, shown }: { all: Patient[]; shown?: Patient[] }) {
  const { t, tp } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'shown' | 'all'>('shown');
  const panelId = useId();
  const filtered = shown && shown.length !== all.length;
  const chosen = filtered && scope === 'shown' ? shown : all;

  const save = (format: ExportFormat) => {
    try {
      const name = downloadExport(chosen, format);
      toast({ message: t('Downloaded {file}', { file: name }), type: 'success' });
      setOpen(false);
    } catch (err) {
      toast({ message: `${t('Could not make the file:')} ${err instanceof Error ? err.message : ''}`, type: 'error' });
    }
  };

  return (
    <div className="w-full">
      <button type="button" className="btn-secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} disabled={all.length === 0}>
        <Icon name="download" className="h-5 w-5" /> {t('Download')}
      </button>
      {open && (
        <div id={panelId} className="card mt-3 space-y-4" role="region" aria-label={t('Download patient records')}>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Download patient records')}</h2>
            <p className="form-help">{t('The file opens in Excel, Google Sheets or LibreOffice.')}</p>
          </div>
          {filtered && (
            <fieldset>
              <legend className="form-label">{t('Which patients?')}</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                {(['shown', 'all'] as const).map((s) => (
                  <label key={s} className="inline-flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 text-base">
                    <input type="radio" name={`${panelId}-scope`} checked={scope === s} onChange={() => setScope(s)} className="h-5 w-5 accent-brand-600" />
                    {s === 'shown'
                      ? tp(shown!.length, 'Only the {count} patient shown', 'Only the {count} patients shown')
                      : tp(all.length, 'All {count} patient', 'All {count} patients')}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary" onClick={() => save('xlsx')}>
              <Icon name="file" className="h-5 w-5" /> {t('Excel file (.xlsx)')}
            </button>
            <button type="button" className="btn-plain" onClick={() => save('csv')}>
              <Icon name="file" className="h-5 w-5" /> {t('CSV file (.csv)')}
            </button>
          </div>
          <p className="notice-warning text-sm">
            <Icon name="lock" className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{t('The downloaded file is not locked. Keep it private and delete it when you no longer need it.')}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * exportPatients.ts — patient records as a CSV file or an Excel workbook.
 *
 * Built from the records on this device, so it works offline. Headings follow
 * the app's language; the values are written exactly as recorded, so a file
 * exported in Hindi still sorts and filters the same way.
 */
import type { Patient } from '@shared/types';
import { t } from '../i18n/i18n';
import { toCsv, toXlsx, type Cell, type Sheet } from './spreadsheet';

export type ExportFormat = 'csv' | 'xlsx';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function age(dob: string, today = new Date()): number | '' {
  const birth = new Date(`${dob}T00:00:00`);
  if (!dob || Number.isNaN(birth.getTime())) return '';
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return years;
}

/** "2026-10-24T09:30:00.000Z" -> "2026-10-24 15:00" in the device's time zone. */
function stamp(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** One row per patient: the sheet most people want, and the whole CSV file. */
export function patientRows(patients: Patient[], today = new Date()): Cell[][] {
  const head = [
    'Name', 'Date of birth', 'Age (years)', 'Gender', 'Blood group', 'Phone number', 'Allergies', 'Current medicines',
    'Blood pressure', 'Pulse (per minute)', 'Temperature (°C)', 'Breathing rate (per minute)', 'Oxygen level (SpO₂ %)',
    'Last check-up', 'Dose waiting for review', 'Registered', 'Last updated', 'Record ID',
  ].map((h) => t(h));
  const rows = patients.map((p): Cell[] => {
    const v = p.vitals[0];
    return [
      p.name,
      p.dateOfBirth,
      age(p.dateOfBirth, today),
      cap(p.gender),
      p.bloodType,
      p.contactNumber,
      p.allergies
        .map((a) => {
          const detail = [a.severity !== 'unknown' ? a.severity : '', a.reaction].filter(Boolean).join(', ');
          return detail ? `${a.allergen} (${detail})` : a.allergen;
        })
        .join('; '),
      p.medications.map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join('; '),
      v?.bloodPressure ?? '',
      v?.heartRate ?? '',
      v?.temperature ?? '',
      v?.respiratoryRate ?? '',
      v?.oxygenSaturation ?? '',
      stamp(v?.recordedAt),
      p.hasOpenConflicts ? t('Yes') : t('No'),
      stamp(p.createdAt),
      stamp(p.updatedAt),
      p.id,
    ];
  });
  return [head, ...rows];
}

function workbook(patients: Patient[], today: Date): Sheet[] {
  return [
    { name: t('Patients'), rows: patientRows(patients, today) },
    {
      name: t('Allergies'),
      rows: [
        ['Name', 'Allergy', 'How serious', 'Reaction', 'Record ID'].map((h) => t(h)),
        ...patients.flatMap((p) => p.allergies.map((a): Cell[] => [p.name, a.allergen, cap(a.severity), a.reaction, p.id])),
      ],
    },
    {
      name: t('Medicines'),
      rows: [
        ['Name', 'Medicine', 'Dose', 'How often', 'Start date', 'End date', 'Dose waiting for review', 'Record ID'].map((h) => t(h)),
        ...patients.flatMap((p) =>
          p.medications.map((m): Cell[] => [p.name, m.name, m.dosage, m.frequency, m.startDate, m.endDate, m.openConflictIds.length ? t('Yes') : t('No'), p.id]),
        ),
      ],
    },
    {
      name: t('Check-ups'),
      rows: [
        ['Name', 'Date and time', 'Blood pressure', 'Pulse (per minute)', 'Temperature (°C)', 'Breathing rate (per minute)', 'Oxygen level (SpO₂ %)', 'Recorded by', 'Record ID'].map((h) => t(h)),
        ...patients.flatMap((p) =>
          p.vitals.map((v): Cell[] => [p.name, stamp(v.recordedAt), v.bloodPressure ?? '', v.heartRate ?? '', v.temperature ?? '', v.respiratoryRate ?? '', v.oxygenSaturation ?? '', v.recordedBy, p.id]),
        ),
      ],
    },
  ];
}

/** The file's bytes, type and name. Pure, so it can be tested without a browser. */
export function buildExport(patients: Patient[], format: ExportFormat, today = new Date()): { data: Uint8Array; type: string; filename: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  const base = patients.length === 1 ? `patient-${patients[0].name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()}` : 'patients';
  if (format === 'csv') {
    // The byte-order mark makes Excel read the file as UTF-8 (Hindi, ₂, °).
    const text = String.fromCharCode(0xfeff) + toCsv(patientRows(patients, today));
    return { data: new TextEncoder().encode(text), type: 'text/csv;charset=utf-8', filename: `${base}-${date}.csv` };
  }
  return {
    data: toXlsx(workbook(patients, today)),
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${base}-${date}.xlsx`,
  };
}

/** Save the export through the browser's normal download. */
export function downloadExport(patients: Patient[], format: ExportFormat): string {
  const { data, type, filename } = buildExport(patients, format);
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}

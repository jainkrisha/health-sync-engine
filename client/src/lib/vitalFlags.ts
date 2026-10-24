/**
 * vitalFlags.ts — marks a check-up reading that is outside the usual adult
 * range, so it stands out in a column of numbers. These are screening cues
 * (WHO / Indian hypertension guideline cut-offs), not a diagnosis; the
 * clinician decides what they mean for this patient.
 */
import type { VitalReading } from '@shared/types';

export type Flag = 'high' | 'low' | null;

export function bpFlag(bp: string | undefined): Flag {
  const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(bp ?? '');
  if (!m) return null;
  const [sys, dia] = [Number(m[1]), Number(m[2])];
  if (sys >= 140 || dia >= 90) return 'high';
  if (sys < 90 || dia < 60) return 'low';
  return null;
}

export function flagOf(field: keyof VitalReading, value: number | string | undefined): Flag {
  if (value === undefined || value === '') return null;
  if (field === 'bloodPressure') return bpFlag(String(value));
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  switch (field) {
    case 'heartRate':
      return n > 100 ? 'high' : n < 60 ? 'low' : null;
    case 'temperature':
      return n >= 37.5 ? 'high' : n < 35.5 ? 'low' : null;
    case 'respiratoryRate':
      return n > 20 ? 'high' : n < 12 ? 'low' : null;
    case 'oxygenSaturation':
      return n < 95 ? 'low' : null;
    default:
      return null;
  }
}

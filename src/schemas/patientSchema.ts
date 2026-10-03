/**
 * patientSchema.ts — Zod validation for the patient form.
 * Vitals are kept as strings in the form (empty = not measured) and converted on save.
 */
import { z } from 'zod';
import { ALLERGY_SEVERITIES, BLOOD_TYPES, GENDERS } from '@shared/types';

export { BLOOD_TYPES, GENDERS, ALLERGY_SEVERITIES };

const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || !Number.isNaN(Number(v)), { message: `${label} must be a number` })
    .refine((v) => v === '' || (Number(v) >= min && Number(v) <= max), { message: `${label} must be between ${min} and ${max}` });

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const patientSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    dateOfBirth: z
      .string()
      .min(1, 'Date of birth is required')
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' })
      .refine((v) => new Date(v) <= new Date(), { message: 'Date of birth cannot be in the future' }),
    gender: z.enum(GENDERS),
    bloodType: z.enum(BLOOD_TYPES, { message: 'Please select a blood type' }),
    contactNumber: z
      .string()
      .trim()
      .max(20)
      .refine((v) => v === '' || /^[+0-9][0-9\s-]{5,}$/.test(v), { message: 'Enter a valid phone number' }),
    allergies: z.array(
      z.object({
        allergen: z.string().trim().min(1, 'Allergen is required').max(100),
        severity: z.enum(ALLERGY_SEVERITIES),
        reaction: z.string().trim().max(200),
      }),
    ),
    medications: z.array(
      z
        .object({
          name: z.string().trim().min(1, 'Medication name is required').max(100),
          dosage: z.string().trim().min(1, 'Dosage is required').max(100),
          frequency: z.string().trim().max(100),
          startDate: z.string(),
          endDate: z.string(),
        })
        .refine((m) => !m.startDate || !m.endDate || m.endDate >= m.startDate, {
          message: 'End date must be after the start date',
          path: ['endDate'],
        }),
    ),
    newVitals: z.object({
      heartRate: optionalNumber('Heart rate', 20, 300),
      bloodPressure: z
        .string()
        .trim()
        .refine((v) => v === '' || /^\d{2,3}\/\d{2,3}$/.test(v), { message: 'Use systolic/diastolic, e.g. 120/80' }),
      temperature: optionalNumber('Temperature (°C)', 30, 45),
      respiratoryRate: optionalNumber('Respiratory rate', 4, 80),
      oxygenSaturation: optionalNumber('SpO₂', 50, 100),
    }),
  })
  .superRefine((v, ctx) => {
    const seenA = new Set<string>();
    v.allergies.forEach((a, i) => {
      const k = normalise(a.allergen);
      if (k && seenA.has(k)) ctx.addIssue({ code: 'custom', message: 'This allergy is listed twice', path: ['allergies', i, 'allergen'] });
      seenA.add(k);
    });
    const seenM = new Set<string>();
    v.medications.forEach((m, i) => {
      const k = normalise(m.name);
      if (k && seenM.has(k)) ctx.addIssue({ code: 'custom', message: 'This medication is listed twice', path: ['medications', i, 'name'] });
      seenM.add(k);
    });
  });

export type PatientFormValues = z.infer<typeof patientSchema>;

export const emptyVitals: PatientFormValues['newVitals'] = {
  heartRate: '',
  bloodPressure: '',
  temperature: '',
  respiratoryRate: '',
  oxygenSaturation: '',
};

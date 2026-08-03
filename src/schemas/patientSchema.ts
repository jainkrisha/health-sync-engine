/**
 * patientSchema.ts — Zod v4 validation schema for patient forms.
 *
 * OWNERSHIP: Person C.
 *
 * This schema drives React Hook Form validation in PatientFormPage.
 * It must stay in sync with src/types/patient.ts — when the Patient
 * interface gains a field, add it here too.
 *
 * Rules (from rules.md):
 * - Zod validation errors render inline under the relevant field,
 *   not as toasts or alerts.
 *
 * Note: Zod v4 dropped `required_error` in favour of a single `error`
 * string or using .min(1, message) for required string fields.
 */

import { z } from 'zod'

export const patientSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or fewer'),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or fewer'),

  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD'),

  gender: z.enum(['Male', 'Female', 'Other', 'Unknown']),

  bloodType: z.string().max(5).default(''),

  allergies: z.array(z.string().min(1)).default([]),

  /**
   * CRITICAL: medicationDosage is a free-text field.
   * No coercion, no auto-fill of a "default" value.
   * Phase B: conflicts on this field are NEVER auto-resolved.
   */
  medicationDosage: z.string().default(''),

  phone: z.string().max(30).default(''),

  address: z.string().max(500).default(''),
})

export type PatientFormValues = z.infer<typeof patientSchema>

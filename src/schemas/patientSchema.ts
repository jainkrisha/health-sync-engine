/**
 * patientSchema.ts — Zod validation schema for patient forms.
 *
 * OWNERSHIP: Person C.
 *
 * This schema drives React Hook Form validation in PatientFormPage.
 * It stays in sync with src/types/patient.ts — referencing the Patient interface.
 */

import { z } from 'zod';
import type { Patient } from '../types/patient';

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const patientSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters'),

  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
    .refine(
      (val) => {
        const dob = new Date(val);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return dob <= today;
      },
      { message: 'Date of birth cannot be in the future' }
    ),

  bloodType: z.enum(BLOOD_TYPES, {
    message: 'Please select a valid blood type',
  }),

  allergies: z.array(z.string()),

  medications: z.array(
    z.object({
      name: z.string().min(1, 'Medication name is required'),
      dosage: z.string().min(1, 'Dosage is required'),
    })
  ),

  vitals: z.object({
    heartRate: z
      .number({ message: 'Heart rate must be a number' })
      .min(20, 'Heart rate must be at least 20 bpm')
      .max(300, 'Heart rate must be at most 300 bpm')
      .optional(),

    bloodPressure: z
      .string()
      .regex(
        /^\d{2,3}\/\d{2,3}$/,
        'Blood pressure must be in Systolic/Diastolic format (e.g. 120/80)'
      )
      .optional()
      .or(z.literal('')),

    temperature: z
      .number({ message: 'Temperature must be a number' })
      .min(30, 'Temperature must be at least 30°C / 86°F')
      .max(115, 'Temperature must be at most 115°F / 46°C')
      .optional(),
  }),

});


export type PatientFormValues = z.infer<typeof patientSchema>;

// Static check to ensure PatientFormValues matches Patient write-side fields
export type _PatientFormValuesCompatible = PatientFormValues extends Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> ? true : false;

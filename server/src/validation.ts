/**
 * Runtime validation of everything devices send. The shared TypeScript types say
 * what a mutation looks like; these schemas make sure a malformed or malicious
 * payload is rejected before it reaches the merge engine.
 */
import { z } from 'zod';
import { ALLERGY_SEVERITIES, BLOOD_TYPES, GENDERS, ROLES } from '@shared/types';

const id = z.string().min(1).max(100);
const shortText = z.string().max(200);
const isoDate = z.string().max(40);
const clock = z.record(z.string().max(100), z.number().int().nonnegative());

const vitalReading = z.object({
  id,
  recordedAt: isoDate,
  recordedBy: shortText,
  heartRate: z.number().min(0).max(400).optional(),
  bloodPressure: z.string().max(20).optional(),
  temperature: z.number().min(0).max(130).optional(),
  respiratoryRate: z.number().min(0).max(150).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
});

const allergy = z.object({
  allergen: z.string().trim().min(1).max(100),
  severity: z.enum(ALLERGY_SEVERITIES),
  reaction: shortText,
});

const medication = z.object({
  name: z.string().trim().min(1).max(100),
  dosage: shortText,
  frequency: shortText,
  startDate: z.string().max(20),
  endDate: z.string().max(20),
});

const createPayload = z.object({
  name: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().max(20),
  gender: z.enum(GENDERS),
  bloodType: z.enum(BLOOD_TYPES),
  contactNumber: z.string().max(30),
  allergies: z.array(allergy.extend({ tag: id })).max(100),
  medications: z.array(medication).max(100),
  vitals: z.array(vitalReading).max(50),
});

const allergyPayload = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), allergen: z.string().trim().min(1).max(100), severity: z.enum(ALLERGY_SEVERITIES), reaction: shortText, tag: id }),
  z.object({ op: z.literal('remove'), allergen: z.string().trim().min(1).max(100), observedTags: z.array(id).max(1000) }),
]);

const medicationPayload = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setCritical'), name: z.string().trim().min(1).max(100), dosage: shortText, frequency: shortText, active: z.boolean() }),
  z.object({ op: z.literal('setDetails'), name: z.string().trim().min(1).max(100), startDate: z.string().max(20), endDate: z.string().max(20) }),
]);

const scalarValues = {
  name: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().max(20),
  gender: z.enum(GENDERS),
  bloodType: z.enum(BLOOD_TYPES),
  contactNumber: z.string().max(30),
} as const;

const base = {
  id,
  clientId: id,
  userId: z.string().max(100).optional().default(''),
  entityId: id,
  entityType: z.literal('patient'),
  vectorClock: clock,
  timestamp: isoDate,
  status: z.string().optional(),
};

export const mutationSchema = z.union([
  z.object({ ...base, operation: z.literal('create'), field: z.undefined().optional(), payload: createPayload }),
  z.object({ ...base, operation: z.literal('delete'), field: z.undefined().optional(), payload: z.object({}).optional().default({}) }),
  ...Object.entries(scalarValues).map(([field, value]) =>
    z.object({ ...base, operation: z.literal('update'), field: z.literal(field), payload: z.object({ value }) }),
  ),
  z.object({ ...base, operation: z.literal('update'), field: z.literal('allergies'), payload: allergyPayload }),
  z.object({ ...base, operation: z.literal('update'), field: z.literal('medications'), payload: medicationPayload }),
  z.object({ ...base, operation: z.literal('update'), field: z.literal('vitals'), payload: z.object({ op: z.literal('record'), reading: vitalReading }) }),
]);

export const pushSchema = z.object({
  clientId: id,
  deviceName: z.string().max(100).optional(),
  mutations: z.array(z.unknown()).max(500),
});

export const patientInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().max(20).default(''),
  gender: z.enum(GENDERS).default('unknown'),
  bloodType: z.enum(BLOOD_TYPES).default('Unknown'),
  contactNumber: z.string().max(30).default(''),
  allergies: z.array(allergy).max(100).default([]),
  medications: z.array(medication).max(100).default([]),
  newVitals: vitalReading.omit({ id: true, recordedAt: true, recordedBy: true }).nullable().optional(),
});

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
  name: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(6).max(200),
  role: z.enum(ROLES),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
});

const criticalValue = z.object({ dosage: shortText, frequency: shortText, active: z.boolean() });

export const resolveSchema = z.object({
  choice: z.enum(['current', 'incoming', 'custom']),
  value: criticalValue.optional(),
  note: z.string().max(500).optional(),
});

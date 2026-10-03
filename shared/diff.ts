/**
 * diff.ts — turn a form edit into the smallest set of field-level mutations.
 *
 * Only fields the user actually changed produce a mutation, so an edit to a
 * medication's start date never touches its dosage register (and therefore can
 * never cause a false dosage conflict on another device).
 */

import { materialize } from './materialize';
import { normaliseKey, isAllergyPresent } from './mergeEngine';
import { increment, type VectorClock } from './vectorClock';
import type {
  Allergy,
  BloodType,
  CreatePayload,
  Gender,
  Mutation,
  MutationField,
  MutationOperation,
  PatientDoc,
  VitalReading,
} from './types';
import { SCALAR_FIELDS } from './types';

export interface MedicationInput {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
}

export type VitalsInput = Omit<VitalReading, 'id' | 'recordedAt' | 'recordedBy'>;

export interface PatientInput {
  name: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType;
  contactNumber: string;
  allergies: Allergy[];
  medications: MedicationInput[];
  /** A new vitals reading to append, if any value was entered. */
  newVitals?: VitalsInput | null;
}

export interface MutationContext {
  clientId: string;
  userId: string;
  userName: string;
  now: string;
  newId: () => string;
}

export function hasVitals(v: VitalsInput | null | undefined): v is VitalsInput {
  if (!v) return false;
  return (
    v.heartRate !== undefined ||
    (v.bloodPressure !== undefined && v.bloodPressure !== '') ||
    v.temperature !== undefined ||
    v.respiratoryRate !== undefined ||
    v.oxygenSaturation !== undefined
  );
}

function cleanVitals(v: VitalsInput): VitalsInput {
  const out: VitalsInput = {};
  if (v.heartRate !== undefined) out.heartRate = v.heartRate;
  if (v.bloodPressure) out.bloodPressure = v.bloodPressure.trim();
  if (v.temperature !== undefined) out.temperature = v.temperature;
  if (v.respiratoryRate !== undefined) out.respiratoryRate = v.respiratoryRate;
  if (v.oxygenSaturation !== undefined) out.oxygenSaturation = v.oxygenSaturation;
  return out;
}

class MutationBuilder {
  private clock: VectorClock;
  readonly mutations: Mutation[] = [];

  constructor(
    private readonly entityId: string,
    startClock: VectorClock,
    private readonly ctx: MutationContext,
  ) {
    this.clock = startClock;
  }

  add(operation: MutationOperation, field: MutationField | undefined, payload: Mutation['payload']): void {
    this.clock = increment(this.clock, this.ctx.clientId);
    this.mutations.push({
      id: this.ctx.newId(),
      clientId: this.ctx.clientId,
      userId: this.ctx.userId,
      entityId: this.entityId,
      entityType: 'patient',
      operation,
      ...(field ? { field } : {}),
      payload,
      vectorClock: { ...this.clock },
      timestamp: this.ctx.now,
      status: 'pending',
    });
  }
}

function newReading(v: VitalsInput, ctx: MutationContext): VitalReading {
  return { id: ctx.newId(), recordedAt: ctx.now, recordedBy: ctx.userName, ...cleanVitals(v) };
}

export function buildCreateMutation(entityId: string, input: PatientInput, ctx: MutationContext): Mutation {
  const builder = new MutationBuilder(entityId, {}, ctx);
  const payload: CreatePayload = {
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    bloodType: input.bloodType,
    contactNumber: input.contactNumber.trim(),
    allergies: dedupeAllergies(input.allergies).map((a) => ({ ...a, tag: ctx.newId() })),
    medications: dedupeMedications(input.medications).map((m) => ({ ...m })),
    vitals: hasVitals(input.newVitals) ? [newReading(input.newVitals, ctx)] : [],
  };
  builder.add('create', undefined, payload);
  return builder.mutations[0];
}

function dedupeAllergies(list: Allergy[]): Allergy[] {
  const byKey = new Map<string, Allergy>();
  for (const a of list) {
    if (!a.allergen.trim()) continue;
    byKey.set(normaliseKey(a.allergen), { ...a, allergen: a.allergen.trim(), reaction: a.reaction.trim() });
  }
  return [...byKey.values()];
}

function dedupeMedications(list: MedicationInput[]): MedicationInput[] {
  const byKey = new Map<string, MedicationInput>();
  for (const m of list) {
    if (!m.name.trim()) continue;
    byKey.set(normaliseKey(m.name), {
      ...m,
      name: m.name.trim(),
      dosage: m.dosage.trim(),
      frequency: m.frequency.trim(),
    });
  }
  return [...byKey.values()];
}

export function buildUpdateMutations(doc: PatientDoc, input: PatientInput, ctx: MutationContext): Mutation[] {
  const before = materialize(doc);
  const builder = new MutationBuilder(doc.id, doc.clock, ctx);

  for (const field of SCALAR_FIELDS) {
    const next = String(input[field] ?? '').trim();
    if (next !== String(before[field] ?? '')) builder.add('update', field, { value: next });
  }

  // Allergies: OR-Set adds (with a fresh tag) and removes (with observed tags).
  const nextAllergies = new Map(dedupeAllergies(input.allergies).map((a) => [normaliseKey(a.allergen), a]));
  const prevAllergies = new Map(before.allergies.map((a) => [normaliseKey(a.allergen), a]));
  for (const [key, a] of nextAllergies) {
    const prev = prevAllergies.get(key);
    if (!prev || prev.severity !== a.severity || prev.reaction !== a.reaction || prev.allergen !== a.allergen) {
      builder.add('update', 'allergies', {
        op: 'add',
        allergen: a.allergen,
        severity: a.severity,
        reaction: a.reaction,
        tag: ctx.newId(),
      });
    }
  }
  for (const [key, prev] of prevAllergies) {
    if (nextAllergies.has(key)) continue;
    const element = doc.allergies[key];
    const observedTags = element && isAllergyPresent(element)
      ? element.addTags.filter((t) => !element.removedTags.includes(t))
      : [];
    builder.add('update', 'allergies', { op: 'remove', allergen: prev.allergen, observedTags });
  }

  // Medications: critical (dosage/frequency/active) and details (dates) separately.
  const nextMeds = new Map(dedupeMedications(input.medications).map((m) => [normaliseKey(m.name), m]));
  const prevMeds = new Map(before.medications.map((m) => [normaliseKey(m.name), m]));
  for (const [key, m] of nextMeds) {
    const prev = prevMeds.get(key);
    const prevActive = prev ? (doc.medications[key]?.critical.value.active ?? false) : false;
    if (!prev || !prevActive || prev.dosage !== m.dosage || prev.frequency !== m.frequency) {
      builder.add('update', 'medications', {
        op: 'setCritical',
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        active: true,
      });
    }
    if ((m.startDate || m.endDate || prev) && (prev?.startDate ?? '') + (prev?.endDate ?? '') !== m.startDate + m.endDate) {
      builder.add('update', 'medications', {
        op: 'setDetails',
        name: m.name,
        startDate: m.startDate,
        endDate: m.endDate,
      });
    }
  }
  for (const [key, prev] of prevMeds) {
    if (nextMeds.has(key)) continue;
    if (!(doc.medications[key]?.critical.value.active ?? false)) continue;
    builder.add('update', 'medications', {
      op: 'setCritical',
      name: prev.name,
      dosage: prev.dosage,
      frequency: prev.frequency,
      active: false,
    });
  }

  if (hasVitals(input.newVitals)) {
    builder.add('update', 'vitals', { op: 'record', reading: newReading(input.newVitals, ctx) });
  }

  return builder.mutations;
}

export function buildDeleteMutation(doc: PatientDoc, ctx: MutationContext): Mutation {
  const builder = new MutationBuilder(doc.id, doc.clock, ctx);
  builder.add('delete', undefined, {});
  return builder.mutations[0];
}

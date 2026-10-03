/**
 * mergeEngine.ts — the field-level CRDT merge engine.
 *
 * applyMutation() takes the current CRDT document for a patient and one incoming
 * mutation, and returns the new document plus a list of merge decisions (for the
 * audit trail) and conflict drafts (for the Conflict Review dashboard).
 *
 * The same function runs in two places:
 * - on the server ("server" mode), where it is the authority that decides what
 *   the canonical record becomes; and
 * - on a device ("local" mode), to apply the user's own pending edits on top of
 *   the last canonical copy it received, so the UI shows them immediately.
 *
 * Field rules (from the SRS):
 * | field                                        | rule                                   |
 * |----------------------------------------------|----------------------------------------|
 * | name, dateOfBirth, gender, bloodType, contact| LWW register (vector clock, then time) |
 * | allergies                                    | OR-Set, add-wins: never silently lost  |
 * | medications (dosage, frequency, active)      | critical: concurrent change => review  |
 * | medications (start/end dates)                | LWW register                           |
 * | vitals                                       | grow-only set of readings              |
 */

import { compare, merge, type VectorClock } from './vectorClock';
import type {
  AllergyElement,
  AllergyPayload,
  ConflictDraft,
  CreatePayload,
  LWWRegister,
  MedicationCritical,
  MedicationDetails,
  MedicationElement,
  MedicationPayload,
  MergeDecision,
  Mutation,
  PatientDoc,
  ScalarField,
  ScalarPayload,
  ScalarValues,
  VitalsPayload,
} from './types';
import { SCALAR_FIELDS } from './types';

export type ApplyMode = 'server' | 'local';

export interface ApplyContext {
  mode: ApplyMode;
  /** Id generator for conflict records (crypto.randomUUID in practice). */
  newId: () => string;
}

export interface ApplyResult {
  doc: PatientDoc;
  decisions: MergeDecision[];
  conflicts: ConflictDraft[];
}

export const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  bloodType: 'Blood type',
  contactNumber: 'Contact number',
  allergies: 'Allergies',
  medications: 'Medications',
  vitals: 'Vitals',
  patient: 'Patient record',
};

export function normaliseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function emptyRegister<T>(value: T): LWWRegister<T> {
  return { value, clock: {}, timestamp: '', clientId: '' };
}

export function emptyDoc(id: string, createdAt: string, createdBy: string): PatientDoc {
  return {
    id,
    scalars: {
      name: emptyRegister(''),
      dateOfBirth: emptyRegister(''),
      gender: emptyRegister('unknown'),
      bloodType: emptyRegister('Unknown'),
      contactNumber: emptyRegister(''),
    },
    allergies: {},
    medications: {},
    vitals: {},
    deleted: emptyRegister(false),
    clock: {},
    createdAt,
    createdBy,
    updatedAt: createdAt,
  };
}

/** Deep copy so callers never see their input mutated. Documents are plain JSON. */
export function cloneDoc(doc: PatientDoc): PatientDoc {
  return JSON.parse(JSON.stringify(doc)) as PatientDoc;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describe(value: unknown): string {
  if (value === '' || value === undefined || value === null) return '(empty)';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    const v = value as Partial<MedicationCritical>;
    if ('dosage' in v || 'frequency' in v) {
      const parts = [v.dosage, v.frequency].filter(Boolean).join(', ');
      return v.active === false ? `stopped (${parts || 'no dose'})` : parts || '(empty)';
    }
    return JSON.stringify(value);
  }
  return String(value);
}

interface RegisterWrite<T> {
  value: T;
  clock: VectorClock;
  timestamp: string;
  clientId: string;
}

type LwwResult<T> = {
  register: LWWRegister<T>;
  outcome: 'applied' | 'kept_existing' | 'duplicate';
  reason: string;
};

/**
 * Last-Write-Wins on a register. A causally newer write always wins. For truly
 * concurrent writes the later wall-clock timestamp wins, and the client id breaks
 * an exact tie so every replica picks the same winner.
 */
export function applyLww<T>(current: LWWRegister<T>, write: RegisterWrite<T>): LwwResult<T> {
  const order = compare(write.clock, current.clock);
  if (order === 'after') {
    return { register: { ...write }, outcome: 'applied', reason: 'newer write' };
  }
  if (order === 'equal' || order === 'before') {
    const duplicate = order === 'equal' && sameValue(write.value, current.value);
    return {
      register: current,
      outcome: duplicate ? 'duplicate' : 'kept_existing',
      reason: duplicate ? 'already applied' : 'older write, the stored value is newer',
    };
  }
  // concurrent
  const merged = merge(current.clock, write.clock);
  if (sameValue(write.value, current.value)) {
    return {
      register: { ...current, clock: merged },
      outcome: 'kept_existing',
      reason: 'concurrent write with the same value',
    };
  }
  const incomingWins =
    write.timestamp > current.timestamp ||
    (write.timestamp === current.timestamp && write.clientId > current.clientId);
  if (incomingWins) {
    return {
      register: { ...write, clock: merged },
      outcome: 'applied',
      reason: 'concurrent edit, kept the incoming value (newer timestamp)',
    };
  }
  return {
    register: { ...current, clock: merged },
    outcome: 'kept_existing',
    reason: 'concurrent edit, kept the stored value (newer timestamp)',
  };
}

function writeFrom<T>(m: Mutation, value: T): RegisterWrite<T> {
  return { value, clock: m.vectorClock, timestamp: m.timestamp, clientId: m.clientId };
}

// ---------------------------------------------------------------------------
// Field handlers
// ---------------------------------------------------------------------------

function applyScalar<F extends ScalarField>(
  doc: PatientDoc,
  field: F,
  value: ScalarValues[F],
  m: Mutation,
): MergeDecision {
  const result = applyLww(doc.scalars[field], writeFrom(m, value));
  (doc.scalars as Record<ScalarField, LWWRegister<unknown>>)[field] = result.register;
  const label = FIELD_LABELS[field];
  const kept = describe(result.register.value);
  return {
    field,
    rule: 'lww',
    outcome: result.outcome,
    report:
      result.outcome === 'applied'
        ? `${label}: resolved via Last-Write-Wins, set to ${kept} (${result.reason}).`
        : `${label}: resolved via Last-Write-Wins, kept ${kept} (${result.reason}).`,
    finalValue: result.register.value,
  };
}

function applyAllergy(doc: PatientDoc, payload: AllergyPayload, m: Mutation): MergeDecision {
  const key = normaliseKey(payload.allergen);
  const existing = doc.allergies[key];

  if (payload.op === 'add') {
    const element: AllergyElement = existing ?? {
      key,
      addTags: [],
      removedTags: [],
      details: emptyRegister({ allergen: payload.allergen.trim(), severity: 'unknown', reaction: '' }),
    };
    const wasPresent = existing ? isAllergyPresent(existing) : false;
    if (!element.addTags.includes(payload.tag) && !element.removedTags.includes(payload.tag)) {
      element.addTags = [...element.addTags, payload.tag];
    }
    const details = applyLww(
      element.details,
      writeFrom(m, { allergen: payload.allergen.trim(), severity: payload.severity, reaction: payload.reaction }),
    );
    element.details = details.register;
    doc.allergies[key] = element;
    const name = element.details.value.allergen;
    let report: string;
    if (!wasPresent) report = `Allergies: added "${name}" (OR-Set add).`;
    else if (details.outcome === 'applied') report = `Allergies: updated "${name}" details (${details.reason}).`;
    else report = `Allergies: "${name}" already recorded, union kept every entry (${details.reason}).`;
    return {
      field: 'allergies',
      key,
      rule: 'or-set',
      outcome: !wasPresent ? 'applied' : details.outcome === 'applied' ? 'applied' : 'merged',
      report,
      finalValue: element.details.value,
    };
  }

  // remove
  if (!existing) {
    return {
      field: 'allergies',
      key,
      rule: 'or-set',
      outcome: 'kept_existing',
      report: `Allergies: remove of "${payload.allergen}" ignored, it was never recorded here.`,
      finalValue: null,
    };
  }
  const observed = payload.observedTags.filter((t) => existing.addTags.includes(t));
  existing.removedTags = Array.from(new Set([...existing.removedTags, ...observed]));
  const name = existing.details.value.allergen;
  if (isAllergyPresent(existing)) {
    return {
      field: 'allergies',
      key,
      rule: 'or-set',
      outcome: 'merged',
      report: `Allergies: remove of "${name}" did not apply because another device added or updated it concurrently (add-wins, never-lose rule).`,
      finalValue: existing.details.value,
    };
  }
  return {
    field: 'allergies',
    key,
    rule: 'or-set',
    outcome: 'applied',
    report: `Allergies: "${name}" removed by explicit user action.`,
    finalValue: null,
  };
}

export function isAllergyPresent(element: AllergyElement): boolean {
  return element.addTags.some((t) => !element.removedTags.includes(t));
}

function newMedication(name: string): MedicationElement {
  return {
    key: normaliseKey(name),
    name: name.trim(),
    critical: emptyRegister<MedicationCritical>({ dosage: '', frequency: '', active: false }),
    details: emptyRegister<MedicationDetails>({ startDate: '', endDate: '' }),
    openConflictIds: [],
  };
}

function applyMedication(
  doc: PatientDoc,
  payload: MedicationPayload,
  m: Mutation,
  ctx: ApplyContext,
  conflicts: ConflictDraft[],
): MergeDecision {
  const key = normaliseKey(payload.name);
  const element = doc.medications[key] ?? newMedication(payload.name);
  doc.medications[key] = element;

  if (payload.op === 'setDetails') {
    const result = applyLww(
      element.details,
      writeFrom(m, { startDate: payload.startDate, endDate: payload.endDate }),
    );
    element.details = result.register;
    return {
      field: 'medications',
      key,
      rule: 'lww',
      outcome: result.outcome,
      report: `Medications: "${element.name}" schedule dates resolved via Last-Write-Wins (${result.reason}).`,
      finalValue: element.details.value,
    };
  }

  const incoming: MedicationCritical = {
    dosage: payload.dosage.trim(),
    frequency: payload.frequency.trim(),
    active: payload.active,
  };
  const current = element.critical;
  const order = compare(m.vectorClock, current.clock);
  const wasNew = Object.keys(current.clock).length === 0;

  if (order === 'after') {
    element.critical = writeFrom(m, incoming);
    if (payload.active) element.name = payload.name.trim();
    const action = wasNew
      ? `added at ${describe(incoming)}`
      : incoming.active
        ? `changed from ${describe(current.value)} to ${describe(incoming)}`
        : 'stopped';
    return {
      field: 'medications',
      key,
      rule: 'critical-review',
      outcome: 'applied',
      report: `Medications: "${element.name}" ${action} (sequential edit, no conflict).`,
      finalValue: incoming,
    };
  }

  if (order === 'equal' || order === 'before') {
    return {
      field: 'medications',
      key,
      rule: 'critical-review',
      outcome: order === 'equal' && sameValue(incoming, current.value) ? 'duplicate' : 'kept_existing',
      report: `Medications: "${element.name}" incoming change was older than the stored value, kept ${describe(current.value)}.`,
      finalValue: current.value,
    };
  }

  // concurrent
  if (sameValue(incoming, current.value)) {
    element.critical = { ...current, clock: merge(current.clock, m.vectorClock) };
    return {
      field: 'medications',
      key,
      rule: 'critical-review',
      outcome: 'merged',
      report: `Medications: "${element.name}" concurrent edits agree on ${describe(incoming)}, no review needed.`,
      finalValue: current.value,
    };
  }

  if (ctx.mode === 'local') {
    // Optimistic local view; the server decides whether this becomes a conflict.
    element.critical = { ...writeFrom(m, incoming), clock: merge(current.clock, m.vectorClock) };
    return {
      field: 'medications',
      key,
      rule: 'critical-review',
      outcome: 'applied',
      report: `Medications: "${element.name}" changed locally, awaiting server check.`,
      finalValue: incoming,
    };
  }

  const conflictId = ctx.newId();
  element.openConflictIds = [...element.openConflictIds, conflictId];
  conflicts.push({
    id: conflictId,
    patientId: doc.id,
    field: 'medications',
    key,
    label: element.name,
    currentValue: current.value,
    currentClock: current.clock,
    currentClientId: current.clientId,
    currentTimestamp: current.timestamp,
    incomingValue: incoming,
    incomingClock: m.vectorClock,
    incomingClientId: m.clientId,
    incomingTimestamp: m.timestamp,
    mutationId: m.id,
  });
  return {
    field: 'medications',
    key,
    rule: 'critical-review',
    outcome: 'conflict',
    report: `Medications: "${element.name}" conflict detected (${describe(current.value)} vs ${describe(incoming)}), awaiting manual review.`,
    finalValue: current.value,
  };
}

function applyVital(doc: PatientDoc, payload: VitalsPayload): MergeDecision {
  const reading = payload.reading;
  if (doc.vitals[reading.id]) {
    return {
      field: 'vitals',
      key: reading.id,
      rule: 'g-set',
      outcome: 'duplicate',
      report: 'Vitals: reading already recorded.',
      finalValue: reading,
    };
  }
  doc.vitals[reading.id] = { ...reading };
  return {
    field: 'vitals',
    key: reading.id,
    rule: 'g-set',
    outcome: 'merged',
    report: `Vitals: new reading from ${reading.recordedAt.slice(0, 16).replace('T', ' ')} added to history (readings are never overwritten).`,
    finalValue: reading,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function applyMutation(
  current: PatientDoc | null,
  m: Mutation,
  ctx: ApplyContext,
): ApplyResult {
  const doc = current ? cloneDoc(current) : emptyDoc(m.entityId, m.timestamp, m.userId);
  const decisions: MergeDecision[] = [];
  const conflicts: ConflictDraft[] = [];

  if (m.operation === 'create') {
    const p = m.payload as CreatePayload;
    for (const field of SCALAR_FIELDS) {
      applyScalar(doc, field, p[field] as ScalarValues[typeof field], m);
    }
    for (const a of p.allergies) {
      applyAllergy(doc, { op: 'add', allergen: a.allergen, severity: a.severity, reaction: a.reaction, tag: a.tag }, m);
    }
    for (const med of p.medications) {
      applyMedication(
        doc,
        { op: 'setCritical', name: med.name, dosage: med.dosage, frequency: med.frequency, active: true },
        m,
        ctx,
        conflicts,
      );
      if (med.startDate || med.endDate) {
        applyMedication(
          doc,
          { op: 'setDetails', name: med.name, startDate: med.startDate, endDate: med.endDate },
          m,
          ctx,
          conflicts,
        );
      }
    }
    for (const reading of p.vitals) applyVital(doc, { op: 'record', reading });
    if (!current) {
      doc.createdAt = m.timestamp;
      doc.createdBy = m.userId;
    }
    decisions.push({
      field: 'patient',
      rule: 'create',
      outcome: current ? 'merged' : 'applied',
      report: current
        ? `Patient record "${p.name}" already existed, creation merged field by field.`
        : `Patient record "${p.name}" created with ${p.allergies.length} allergies, ${p.medications.length} medications and ${p.vitals.length} vital readings.`,
      finalValue: { name: p.name },
    });
  } else if (m.operation === 'delete') {
    const result = applyLww(doc.deleted, writeFrom(m, true));
    doc.deleted = result.register;
    decisions.push({
      field: 'patient',
      rule: 'delete',
      outcome: result.outcome,
      report:
        result.outcome === 'applied'
          ? 'Patient record archived (soft delete, history is kept).'
          : `Patient delete not applied (${result.reason}).`,
      finalValue: doc.deleted.value,
    });
  } else {
    const field = m.field;
    if (!field) throw new Error('Update mutation is missing a field');
    if ((SCALAR_FIELDS as readonly string[]).includes(field)) {
      const f = field as ScalarField;
      decisions.push(applyScalar(doc, f, (m.payload as ScalarPayload).value as ScalarValues[typeof f], m));
    } else if (field === 'allergies') {
      decisions.push(applyAllergy(doc, m.payload as AllergyPayload, m));
    } else if (field === 'medications') {
      decisions.push(applyMedication(doc, m.payload as MedicationPayload, m, ctx, conflicts));
    } else if (field === 'vitals') {
      decisions.push(applyVital(doc, m.payload as VitalsPayload));
    } else {
      throw new Error(`Unknown field "${String(field)}"`);
    }
  }

  doc.clock = merge(doc.clock, m.vectorClock);
  if (m.timestamp > doc.updatedAt) doc.updatedAt = m.timestamp;
  return { doc, decisions, conflicts };
}

/**
 * Apply a reviewer's decision to a medication conflict. The written clock is the
 * merge of everything the reviewer saw plus one tick of the server's own counter,
 * so it causally dominates both conflicting writes on every device.
 */
export function resolveMedicationConflict(
  current: PatientDoc,
  input: {
    conflictId: string;
    key: string;
    value: MedicationCritical;
    clocks: VectorClock[];
    serverClientId: string;
    timestamp: string;
  },
): { doc: PatientDoc; decision: MergeDecision } {
  const doc = cloneDoc(current);
  const element = doc.medications[input.key];
  if (!element) throw new Error(`Medication "${input.key}" not found on patient`);
  const base = input.clocks.reduce<VectorClock>((acc, c) => merge(acc, c), merge(element.critical.clock, doc.clock));
  const clock = { ...base, [input.serverClientId]: (base[input.serverClientId] ?? 0) + 1 };
  const previous = element.critical.value;
  element.critical = {
    value: { dosage: input.value.dosage.trim(), frequency: input.value.frequency.trim(), active: input.value.active },
    clock,
    timestamp: input.timestamp,
    clientId: input.serverClientId,
  };
  element.openConflictIds = element.openConflictIds.filter((id) => id !== input.conflictId);
  doc.clock = merge(doc.clock, clock);
  if (input.timestamp > doc.updatedAt) doc.updatedAt = input.timestamp;
  return {
    doc,
    decision: {
      field: 'medications',
      key: input.key,
      rule: 'manual-review',
      outcome: 'resolved',
      report: `Medications: "${element.name}" conflict resolved by a reviewer, ${describe(previous)} -> ${describe(element.critical.value)}.`,
      finalValue: element.critical.value,
    },
  };
}

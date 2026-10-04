/**
 * types.ts — the contract shared by the client (React PWA) and the server (Express).
 *
 * Two shapes of a patient exist:
 * - PatientDoc: the CRDT document, carrying a vector clock on every field so that
 *   concurrent edits from different devices can be detected and merged.
 * - Patient:    the plain "materialized" view the UI renders (see materialize.ts).
 */

import type { VectorClock } from './vectorClock';


// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = ['health_worker', 'clinical_reviewer', 'admin', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  health_worker: 'Health Worker',
  clinical_reviewer: 'Clinical Reviewer',
  admin: 'Administrator',
  auditor: 'Auditor',
};

/** Roles allowed to create or edit patient records. Auditors are read-only. */
export const WRITE_ROLES: Role[] = ['health_worker', 'clinical_reviewer', 'admin'];
export const REVIEW_ROLES: Role[] = ['clinical_reviewer', 'admin'];
export const AUDIT_ROLES: Role[] = ['auditor', 'admin'];

// ---------------------------------------------------------------------------
// Portals: where a user signs in from
// ---------------------------------------------------------------------------

/**
 * phc:      a Primary Health Centre. The local doctor or health worker records
 *           patients on a device that keeps working with no network.
 * district: the central system at the district hospital. Administrators (and the
 *           reviewers and auditors who work there) see every PHC's data, resolve
 *           conflicts and read the audit trail.
 */
export const PORTALS = ['phc', 'district'] as const;
export type Portal = (typeof PORTALS)[number];

export const PORTAL_LABELS: Record<Portal, string> = {
  phc: 'PHC',
  district: 'Admin (District Hospital)',
};

export const PORTAL_ROLES: Record<Portal, Role[]> = {
  phc: ['health_worker'],
  district: ['admin', 'clinical_reviewer', 'auditor'],
};

export const DISTRICT_FACILITY = 'District Hospital';

export function portalForRole(role: Role): Portal {
  return PORTAL_ROLES.phc.includes(role) ? 'phc' : 'district';
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** The PHC (or the district hospital) this account belongs to. */
  facility: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Patient view (what the UI renders)
// ---------------------------------------------------------------------------

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const GENDERS = ['female', 'male', 'other', 'unknown'] as const;
export type Gender = (typeof GENDERS)[number];

export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe', 'unknown'] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export interface Allergy {
  allergen: string;
  severity: AllergySeverity;
  reaction: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  /** Ids of open conflicts on this medication awaiting clinical review. */
  openConflictIds: string[];
}

export interface VitalReading {
  id: string;
  recordedAt: string;
  recordedBy: string;
  heartRate?: number;
  bloodPressure?: string;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}

export interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType;
  contactNumber: string;
  allergies: Allergy[];
  medications: Medication[];
  /** Newest first. */
  vitals: VitalReading[];
  deleted: boolean;
  hasOpenConflicts: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// CRDT document
// ---------------------------------------------------------------------------

/** Last-Write-Wins register: value plus the clock/timestamp of the write that set it. */
export interface LWWRegister<T> {
  value: T;
  clock: VectorClock;
  timestamp: string;
  clientId: string;
}

export const SCALAR_FIELDS = ['name', 'dateOfBirth', 'gender', 'bloodType', 'contactNumber'] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];

export interface ScalarValues {
  name: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType;
  contactNumber: string;
}

/**
 * OR-Set element for one allergen (keyed by normalised allergen name).
 * The allergy is present while it has at least one add-tag that has not been
 * removed. A remove only cancels the tags the removing device had observed, so a
 * concurrent add or update always survives ("add-wins", allergies are never lost).
 */
export interface AllergyElement {
  key: string;
  addTags: string[];
  removedTags: string[];
  details: LWWRegister<Allergy>;
}

export interface MedicationCritical {
  dosage: string;
  frequency: string;
  active: boolean;
}

export interface MedicationDetails {
  startDate: string;
  endDate: string;
}

/**
 * One medication (keyed by normalised name). Dosage, frequency and whether it is
 * active form a "critical" register: concurrent different values are never merged
 * automatically, they become a conflict for a clinical reviewer.
 */
export interface MedicationElement {
  key: string;
  name: string;
  critical: LWWRegister<MedicationCritical>;
  details: LWWRegister<MedicationDetails>;
  openConflictIds: string[];
}

export interface PatientDoc {
  id: string;
  scalars: { [F in ScalarField]: LWWRegister<ScalarValues[F]> };
  allergies: Record<string, AllergyElement>;
  medications: Record<string, MedicationElement>;
  /** Grow-only set of vital readings keyed by reading id. */
  vitals: Record<string, VitalReading>;
  deleted: LWWRegister<boolean>;
  /** Merge of every clock applied to this document. */
  clock: VectorClock;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mutations (what devices sync)
// ---------------------------------------------------------------------------

export type MutationOperation = 'create' | 'update' | 'delete';
export type MutationField = ScalarField | 'allergies' | 'medications' | 'vitals';
export type MutationStatus = 'pending' | 'synced' | 'conflict' | 'resolved' | 'rejected';

export interface CreatePayload {
  name: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType;
  contactNumber: string;
  allergies: (Allergy & { tag: string })[];
  medications: (Omit<Medication, 'openConflictIds'>)[];
  vitals: VitalReading[];
}

export type ScalarPayload = { value: string };

export type AllergyPayload =
  | { op: 'add'; allergen: string; severity: AllergySeverity; reaction: string; tag: string }
  | { op: 'remove'; allergen: string; observedTags: string[] };

export type MedicationPayload =
  | { op: 'setCritical'; name: string; dosage: string; frequency: string; active: boolean }
  | { op: 'setDetails'; name: string; startDate: string; endDate: string };

export type VitalsPayload = { op: 'record'; reading: VitalReading };

export interface Mutation {
  id: string;
  clientId: string;
  userId: string;
  entityId: string;
  entityType: 'patient';
  operation: MutationOperation;
  field?: MutationField;
  payload: CreatePayload | ScalarPayload | AllergyPayload | MedicationPayload | VitalsPayload | Record<string, never>;
  vectorClock: VectorClock;
  timestamp: string;
  status: MutationStatus;
}

// ---------------------------------------------------------------------------
// Merge decisions, conflicts and audit entries
// ---------------------------------------------------------------------------

export type MergeRule =
  | 'create'
  | 'lww'
  | 'or-set'
  | 'g-set'
  | 'critical-review'
  | 'manual-review'
  | 'delete';

export type MergeOutcome =
  /** Incoming write was newer (or concurrent and won LWW) and was applied. */
  | 'applied'
  /** Concurrent write combined with the existing state (set union). */
  | 'merged'
  /** Incoming write was older than what is stored, or lost LWW; kept the stored value. */
  | 'kept_existing'
  /** Already applied (duplicate delivery). */
  | 'duplicate'
  /** Concurrent change to a critical field; routed to human review. */
  | 'conflict'
  /** A reviewer resolved a conflict. */
  | 'resolved';

export interface MergeDecision {
  field: MutationField | 'patient';
  key?: string;
  rule: MergeRule;
  outcome: MergeOutcome;
  report: string;
  finalValue: unknown;
  /** True when the incoming write was concurrent with the stored one (a real merge). */
  concurrent: boolean;
}

export interface ConflictDraft {
  id: string;
  patientId: string;
  field: 'medications';
  key: string;
  label: string;
  currentValue: MedicationCritical;
  currentClock: VectorClock;
  currentClientId: string;
  currentTimestamp: string;
  incomingValue: MedicationCritical;
  incomingClock: VectorClock;
  incomingClientId: string;
  incomingTimestamp: string;
  mutationId: string;
}

export type ConflictStatus = 'pending_review' | 'resolved';
export type ConflictChoice = 'current' | 'incoming' | 'custom';

export interface Conflict extends ConflictDraft {
  patientName: string;
  status: ConflictStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolution?: ConflictChoice;
  resolvedValue?: MedicationCritical;
  note?: string;
}

export type ResolutionType = 'automatic' | 'manual';

export interface AuditEntry {
  id: string;
  mutationId: string | null;
  conflictId: string | null;
  patientId: string;
  patientName: string;
  field: string;
  key?: string;
  rule: MergeRule;
  outcome: MergeOutcome;
  resolutionType: ResolutionType;
  report: string;
  finalValue: unknown;
  concurrent: boolean;
  clientId: string | null;
  userId: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Sync wire protocol
// ---------------------------------------------------------------------------

export interface MutationResult {
  mutationId: string;
  status: Extract<MutationStatus, 'synced' | 'conflict' | 'rejected'>;
  reason?: string;
}

export interface PushResponse {
  results: MutationResult[];
  patients: PatientDoc[];
  serverSeq: number;
}

export interface PullResponse {
  patients: PatientDoc[];
  serverSeq: number;
}

export const SOCKET_EVENTS = {
  /** client -> server: { mutations } with an ack callback receiving PushResponse */
  push: 'mutation:push',
  /** server -> sender: { mutationIds, results } */
  ack: 'sync:ack',
  /** server -> all clients: { patient: PatientDoc, serverSeq } after a merge */
  patientChanged: 'patient:changed',
  /** server -> reviewers: { conflict } */
  conflictChanged: 'conflict:changed',
  /** client -> server: { since } with ack callback receiving PullResponse */
  pull: 'sync:pull',
} as const;

export interface StatsResponse {
  patients: number;
  mutationsByDay: { date: string; synced: number; conflicts: number }[];
  conflicts: { pending: number; resolved: number };
  resolutions: { automatic: number; manual: number };
  devices: number;
}

/** District view of one Primary Health Centre (GET /api/phcs). */
export interface PhcSummary {
  name: string;
  staff: { name: string; username: string; role: Role }[];
  devices: { clientId: string; deviceName: string; username: string; lastSyncAt: string; online: boolean }[];
  patientCount: number;
  recentPatients: { id: string; name: string; updatedAt: string; needsReview: boolean }[];
  activity: { date: string; count: number }[];
  syncedThisWeek: number;
  openConflicts: { patientName: string; label: string; createdAt: string }[];
  lastSyncAt: string | null;
  since: string | null;
}

export interface DeviceInfo {
  clientId: string;
  deviceName: string;
  userId: string;
  username: string;
  facility: string;
  lastSyncAt: string;
  online: boolean;
}

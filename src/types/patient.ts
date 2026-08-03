/**
 * Patient — the canonical on-device data shape for Phase A.
 *
 * OWNERSHIP: Person A. Do not add, rename, or remove fields without
 * updating this file AND memory.md. Other modules import this interface
 * directly — any signature change is a breaking change.
 *
 * Phase A only: no vector clock, no sync metadata.
 * Phase B will extend this (or a sub-type) with clock stamps in db.ts.
 */
export interface Patient {
  /** Auto-incremented primary key from Dexie/IndexedDB */
  id?: number

  // ── Identity ──────────────────────────────────────────────────────────
  firstName: string
  lastName: string
  /** ISO date string: YYYY-MM-DD */
  dateOfBirth: string
  /** Male | Female | Other | Unknown */
  gender: 'Male' | 'Female' | 'Other' | 'Unknown'

  // ── Clinical ──────────────────────────────────────────────────────────
  /** ABO+Rh string e.g. "O+" | "AB-" | "" (unknown) */
  bloodType: string
  /**
   * Allergy list — CRITICAL: items are never removed as a side effect of
   * a merge. Only explicit user tombstone removes an entry.
   * Phase A: plain strings. Phase B: each entry gets a Set-CRDT envelope.
   */
  allergies: string[]
  /**
   * Medication dosage — CRITICAL: never auto-resolved in any merge.
   * Phase B will route conflicts here to the human-review queue.
   */
  medicationDosage: string

  // ── Contact ───────────────────────────────────────────────────────────
  phone: string
  /** Freeform address */
  address: string

  // ── Record metadata ───────────────────────────────────────────────────
  /** ISO timestamp: set on create, never mutated */
  createdAt: string
  /** ISO timestamp: updated on every local write */
  updatedAt: string
}

/**
 * db.ts — Dexie v4 / IndexedDB database definition and CRUD helpers.
 *
 * OWNERSHIP: Person A.
 *
 * Exports (stable — do not rename without flagging):
 *   db, addPatient, getAllPatients, getPatientById, updatePatient, deletePatient
 *
 * Phase A: no vector clock stamping. No network calls ever leave this file.
 * Phase B: vector clock stamps will be wired in here — that is a tracked change.
 *
 * Uses Dexie v4. The class-extends pattern still works in v4 — the
 * `version()` call must come after `super()` in the constructor body.
 */

import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Patient } from '../types/patient'

// ── Schema ────────────────────────────────────────────────────────────────────

class HealthSyncDB extends Dexie {
  // Dexie v4: declare the table as a class property, typed via Table<T, Key>
  patients!: Table<Patient, number>

  constructor() {
    super('HealthSyncDB')
    // Version 1 — Phase A schema.
    // ++id = auto-increment PK; remaining fields are indexed for queries.
    this.version(1).stores({
      patients: '++id, lastName, firstName, dateOfBirth, updatedAt',
    })
  }
}

export const db = new HealthSyncDB()

// ── CRUD helpers ──────────────────────────────────────────────────────────────

/**
 * Add a new patient record. Sets createdAt and updatedAt to now.
 * Returns the new auto-generated id.
 */
export async function addPatient(
  data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = new Date().toISOString()
  const id = await db.patients.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * Fetch every patient record. Returns an empty array if none exist.
 */
export async function getAllPatients(): Promise<Patient[]> {
  return db.patients.toArray()
}

/**
 * Fetch a single patient by primary key. Returns undefined if not found.
 */
export async function getPatientById(id: number): Promise<Patient | undefined> {
  return db.patients.get(id)
}

/**
 * Update mutable fields on an existing patient. Always refreshes updatedAt.
 * Omit id/createdAt from the payload — they are never changed here.
 */
export async function updatePatient(
  id: number,
  changes: Partial<Omit<Patient, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.patients.update(id, {
    ...changes,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Delete a patient record by id.
 * NOTE: In Phase B this will be replaced with a soft-delete / tombstone so
 * allergy data on other devices isn't silently dropped on the next sync.
 */
export async function deletePatient(id: number): Promise<void> {
  await db.patients.delete(id)
}

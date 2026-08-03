/**
 * usePatients.ts — hook for fetching + mutating the patient list.
 * OWNERSHIP: Person B.
 *
 * Stub — implementation to be added during Phase A.
 * Exports the hook signature so PatientListPage can import it without errors.
 */

import type { Patient } from '../types/patient'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function usePatients(): { patients: Patient[]; loading: boolean; error: string | null } {
  // TODO (Person B): implement with Dexie live query
  return { patients: [], loading: false, error: null }
}

/**
 * usePatients.ts — hook for fetching + mutating the patient list.
 * OWNERSHIP: Person B.
 *
 * Reads all patients from IndexedDB via Dexie (getAllPatients).
 * Manual refetch pattern: call refetch() after any write to re-sync the list.
 * No network calls — fully offline, pure IndexedDB reads via db.ts helpers.
 *
 * Error handling: any Dexie/IndexedDB failure on load or delete is caught here
 * and exposed via the `error` field so the page can surface it via toast.
 * Per rules.md §5 — no silent swallowing.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Patient } from '../types/patient'
import { getAllPatients, deletePatient } from '../db/db'

interface UsePatientsResult {
  patients: Patient[]
  loading: boolean
  /** Non-null when the last IndexedDB operation failed. Page must surface this via toast. */
  error: string | null
  refetch: () => Promise<void>
  removePatient: (id: string) => Promise<void>
}

export function usePatients(): UsePatientsResult {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState<boolean>(true)
  const [error, setError]       = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllPatients()
      setPatients(data)
    } catch (err) {
      // Surface Dexie/IndexedDB errors to the page — rules.md §5.
      const message = err instanceof Error ? err.message : 'Failed to load patient records'
      setError(message)
    } finally {
      // Always clear loading — spinner must not spin forever.
      setLoading(false)
    }
  }, [])

  // Load on mount — error is caught inside refetch and stored in `error` state.
  useEffect(() => {
    void refetch()
  }, [refetch])

  const removePatient = useCallback(
    async (id: string) => {
      await deletePatient(id)
      await refetch()
    },
    [refetch],
  )

  return { patients, loading, error, refetch, removePatient }
}

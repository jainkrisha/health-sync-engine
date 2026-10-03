/**
 * usePatients.ts — patient records from the device's encrypted local store.
 * Re-reads automatically when local data changes (local edits or sync).
 */
import { useEffect, useState } from 'react';
import type { Patient, PatientDoc } from '@shared/types';
import { getAllPatients, getPatientDoc } from '../db/patientRepo';
import { onDataChanged } from '../lib/events';
import { materialize } from '@shared/materialize';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      getAllPatients()
        .then((list) => {
          if (!active) return;
          setPatients(list);
          setError(null);
        })
        .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Failed to load patient records'))
        .finally(() => active && setLoading(false));
    void load();
    const off = onDataChanged(() => void load());
    return () => {
      active = false;
      off();
    };
  }, []);

  return { patients, loading, error };
}

export function usePatient(id: string | undefined) {
  const [state, setState] = useState<{ id: string | undefined; doc: PatientDoc | null; error: string | null }>({
    id: undefined,
    doc: null,
    error: null,
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = () =>
      getPatientDoc(id)
        .then((doc) => active && setState({ id, doc, error: null }))
        .catch((err: unknown) => active && setState({ id, doc: null, error: err instanceof Error ? err.message : 'Failed to load patient' }));
    void load();
    const off = onDataChanged(() => void load());
    return () => {
      active = false;
      off();
    };
  }, [id]);

  const doc = state.id === id ? state.doc : null;
  return {
    doc,
    patient: doc ? materialize(doc) : null,
    loading: Boolean(id) && state.id !== id,
    error: state.error,
  };
}

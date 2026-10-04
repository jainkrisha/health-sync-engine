/**
 * usePatientForm.ts — load, validate and save the patient form.
 *
 * Saving never writes a whole record: it turns the user's changes into
 * field-level mutations (shared/diff.ts), applies them to the local copy and
 * queues them for sync. Changes that arrive from other devices while the form
 * is open are preserved (three-way rebase against the snapshot the form opened with).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  buildCreateMutation,
  buildUpdateMutations,
  inputFromDoc,
  rebaseInput,
  type PatientInput,
  type VitalsInput,
} from '@shared/diff';
import { materialize } from '@shared/materialize';
import type { Patient } from '@shared/types';
import { plural } from '@shared/text';
import { emptyVitals, patientSchema, type PatientFormValues } from '../schemas/patientSchema';
import { commitLocalEdit, getPatientDoc } from '../db/patientRepo';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getClientId } from '../lib/deviceProfile';

export interface UsePatientFormOptions {
  mode?: 'add' | 'edit';
}

const defaults: PatientFormValues = {
  name: '',
  dateOfBirth: '',
  gender: 'unknown',
  bloodType: 'Unknown',
  contactNumber: '',
  allergies: [],
  medications: [],
  newVitals: emptyVitals,
};

function toInput(values: PatientFormValues): PatientInput {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const vitals: VitalsInput = {
    heartRate: num(values.newVitals.heartRate),
    bloodPressure: values.newVitals.bloodPressure.trim() || undefined,
    temperature: num(values.newVitals.temperature),
    respiratoryRate: num(values.newVitals.respiratoryRate),
    oxygenSaturation: num(values.newVitals.oxygenSaturation),
  };
  return {
    name: values.name.trim(),
    dateOfBirth: values.dateOfBirth,
    gender: values.gender,
    bloodType: values.bloodType,
    contactNumber: values.contactNumber.trim(),
    allergies: values.allergies.map((a) => ({ ...a, allergen: a.allergen.trim(), reaction: a.reaction.trim() })),
    medications: values.medications.map((m) => ({
      name: m.name.trim(),
      dosage: m.dosage.trim(),
      frequency: m.frequency.trim(),
      startDate: m.startDate,
      endDate: m.endDate,
    })),
    newVitals: vitals,
  };
}

function toFormValues(input: PatientInput): PatientFormValues {
  return {
    name: input.name,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    bloodType: input.bloodType,
    contactNumber: input.contactNumber,
    allergies: input.allergies.map((a) => ({ ...a })),
    medications: input.medications.map((m) => ({ ...m })),
    newVitals: emptyVitals,
  };
}

export function usePatientForm(options: UsePatientFormOptions = {}) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditMode = options.mode === 'edit' && Boolean(id);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [snapshot, setSnapshot] = useState<PatientInput | null>(null);

  const form = useForm<PatientFormValues>({ resolver: zodResolver(patientSchema), defaultValues: defaults });
  const { reset } = form;

  useEffect(() => {
    if (!isEditMode || !id) return;
    let active = true;
    (async () => {
      try {
        const doc = await getPatientDoc(id);
        if (!active) return;
        if (!doc || doc.deleted.value) {
          toast({ message: 'Patient not found on this device', type: 'error' });
          navigate('/patients');
          return;
        }
        const opened = inputFromDoc(doc);
        setSnapshot(opened);
        setPatient(materialize(doc));
        reset(toFormValues(opened));
      } catch (err) {
        if (!active) return;
        toast({ message: `Failed to load patient: ${err instanceof Error ? err.message : 'unknown error'}`, type: 'error' });
        navigate('/patients');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEditMode, reset, navigate, toast]);

  const onSubmit = async (values: PatientFormValues) => {
    if (!user) return;
    const ctx = {
      clientId: getClientId(),
      userId: user.id,
      userName: user.name,
      now: new Date().toISOString(),
      newId: () => crypto.randomUUID(),
    };
    const edited = toInput(values);
    try {
      if (isEditMode && id) {
        const mutations = await commitLocalEdit(id, (current) => {
          if (!current) throw new Error('Patient no longer exists on this device');
          const base = snapshot ?? inputFromDoc(current);
          return buildUpdateMutations(current, rebaseInput(base, edited, inputFromDoc(current)), ctx);
        });
        toast({ message: mutations.length ? `Saved ${plural(mutations.length, 'change')}. They will sync automatically.` : 'No changes to save', type: mutations.length ? 'success' : 'info' });
        navigate(`/patients/${id}`);
      } else {
        const newId = crypto.randomUUID();
        await commitLocalEdit(newId, () => [buildCreateMutation(newId, edited, ctx)]);
        toast({ message: 'Patient saved on this device', type: 'success' });
        navigate(`/patients/${newId}`);
      }
    } catch (err) {
      toast({ message: `Failed to save: ${err instanceof Error ? err.message : 'unknown error'}`, type: 'error' });
    }
  };

  return {
    form,
    patient,
    isLoading,
    isSubmitting: form.formState.isSubmitting,
    isEditMode,
    patientId: id,
    onSubmit: form.handleSubmit(onSubmit),
    handleCancel: () => navigate(isEditMode && id ? `/patients/${id}` : '/patients'),
  };
}

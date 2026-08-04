import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, type PatientFormValues } from '../schemas/patientSchema';
import { addPatient, getPatientById, updatePatient } from '../db/db';
import type { Patient } from '../types/patient';
import { useToast } from '../components/Toast';

export interface UsePatientFormOptions {
  mode?: 'add' | 'edit';
}

export function usePatientForm(options: UsePatientFormOptions = {}) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = options.mode === 'edit' || Boolean(id);
  const [isLoading, setIsLoading] = useState<boolean>(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      dateOfBirth: '',
      bloodType: 'O+',
      allergies: [],
      medications: [],
      vitals: {
        heartRate: undefined,
        bloodPressure: '',
        temperature: undefined,
      },
    },
  });

  const { reset } = form;

  useEffect(() => {
    let isMounted = true;

    async function loadPatient() {
      if (!isEditMode || !id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const patient = await getPatientById(id);
        if (!isMounted) return;

        if (patient) {
          reset({
            name: patient.name || '',
            dateOfBirth: patient.dateOfBirth || '',
            bloodType: (patient.bloodType as PatientFormValues['bloodType']) || 'O+',
            allergies: patient.allergies || [],
            medications: patient.medications || [],
            vitals: {
              heartRate: patient.vitals?.heartRate,
              bloodPressure: patient.vitals?.bloodPressure || '',
              temperature: patient.vitals?.temperature,
            },
          });
        } else {
          toast({ message: 'Patient not found', type: 'error' });
          navigate('/patients');
        }
      } catch (err: any) {
        if (!isMounted) return;
        toast({ message: `Failed to load patient: ${err?.message || 'Unknown error'}`, type: 'error' });
        navigate('/patients');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPatient();

    return () => {
      isMounted = false;
    };
  }, [id, isEditMode, reset, navigate, toast]);

  const onSubmit = async (values: PatientFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (isEditMode && id) {
        const changes: Partial<Patient> = {
          name: values.name.trim(),
          dateOfBirth: values.dateOfBirth,
          bloodType: values.bloodType,
          allergies: values.allergies,
          medications: values.medications.filter((m) => m.name.trim() !== ''),
          vitals: {
            heartRate: values.vitals?.heartRate !== undefined ? Number(values.vitals.heartRate) : undefined,
            bloodPressure: values.vitals?.bloodPressure?.trim() || undefined,
            temperature: values.vitals?.temperature !== undefined ? Number(values.vitals.temperature) : undefined,
          },
          updatedAt: now,
        };

        await updatePatient(id, changes);
      } else {
        const newPatient: Patient = {
          id: crypto.randomUUID(),
          name: values.name.trim(),
          dateOfBirth: values.dateOfBirth,
          bloodType: values.bloodType,
          allergies: values.allergies,
          medications: values.medications.filter((m) => m.name.trim() !== ''),
          vitals: {
            heartRate: values.vitals?.heartRate !== undefined ? Number(values.vitals.heartRate) : undefined,
            bloodPressure: values.vitals?.bloodPressure?.trim() || undefined,
            temperature: values.vitals?.temperature !== undefined ? Number(values.vitals.temperature) : undefined,
          },
          createdAt: now,
          updatedAt: now,
        };

        await addPatient(newPatient);
      }

      toast({ message: 'Patient saved', type: 'success' });
      navigate('/patients');
    } catch (err: any) {
      toast({ message: `Failed to save patient: ${err?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/patients');
  };

  return {
    form,
    isLoading,
    isSubmitting,
    isEditMode,
    patientId: id,
    onSubmit: form.handleSubmit(onSubmit),
    handleCancel,
  };
}

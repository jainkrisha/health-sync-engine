/**
 * materialize.ts — turn a CRDT PatientDoc into the plain Patient the UI renders.
 */

import { isAllergyPresent } from './mergeEngine';
import type { Patient, PatientDoc } from './types';

export function materialize(doc: PatientDoc): Patient {
  const allergies = Object.values(doc.allergies)
    .filter(isAllergyPresent)
    .map((a) => ({ ...a.details.value }))
    .sort((a, b) => a.allergen.localeCompare(b.allergen));

  const medications = Object.values(doc.medications)
    .filter((m) => m.critical.value.active || m.openConflictIds.length > 0)
    .map((m) => ({
      name: m.name,
      dosage: m.critical.value.dosage,
      frequency: m.critical.value.frequency,
      startDate: m.details.value.startDate,
      endDate: m.details.value.endDate,
      openConflictIds: [...m.openConflictIds],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const vitals = Object.values(doc.vitals).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return {
    id: doc.id,
    name: doc.scalars.name.value,
    dateOfBirth: doc.scalars.dateOfBirth.value,
    gender: doc.scalars.gender.value,
    bloodType: doc.scalars.bloodType.value,
    contactNumber: doc.scalars.contactNumber.value,
    allergies,
    medications,
    vitals,
    deleted: doc.deleted.value,
    hasOpenConflicts: medications.some((m) => m.openConflictIds.length > 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

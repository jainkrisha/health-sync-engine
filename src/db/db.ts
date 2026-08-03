import Dexie, { type Table } from 'dexie';
import type { Patient } from '../types/patient';

export class HealthRecordDB extends Dexie {
  patients!: Table<Patient>;

  constructor() {
    super('HealthRecordDB');
    this.version(1).stores({
      patients: 'id, name, updatedAt'
    });
  }
}

export const db = new HealthRecordDB();

export async function addPatient(patient: Patient): Promise<void> {
  await db.patients.add(patient);
}

export async function getAllPatients(): Promise<Patient[]> {
  return await db.patients.toArray();
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  return await db.patients.get(id);
}

export async function updatePatient(id: string, changes: Partial<Patient>): Promise<void> {
  await db.patients.update(id, changes);
}

export async function deletePatient(id: string): Promise<void> {
  await db.patients.delete(id);
}

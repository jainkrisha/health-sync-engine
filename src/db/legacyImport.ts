/**
 * legacyImport.ts — moves records saved by the Phase A build (database
 * "HealthRecordDB", plaintext) into the new encrypted, syncable store, once.
 */
import Dexie from 'dexie';
import { buildCreateMutation, type PatientInput } from '@shared/diff';
import { BLOOD_TYPES, type BloodType } from '@shared/types';
import { getMeta, setMeta } from './db';
import { commitLocalEdit } from './patientRepo';
import { getClientId } from '../lib/deviceProfile';
import { getSession } from '../lib/authStore';

interface LegacyPatient {
  id: string;
  name: string;
  dateOfBirth: string;
  bloodType: string;
  allergies: string[];
  medications: { name: string; dosage: string }[];
  vitals: { heartRate?: number; bloodPressure?: string; temperature?: number };
}

let running = false;

export async function importLegacyPatients(): Promise<number> {
  const session = getSession();
  if (running || !session) return 0;
  running = true;
  try {
    if (await getMeta('legacyImported', false)) return 0;
    if (!(await Dexie.exists('HealthRecordDB'))) {
      await setMeta('legacyImported', true);
      return 0;
    }
    const legacy = new Dexie('HealthRecordDB');
    legacy.version(1).stores({ patients: 'id, name, updatedAt' });
    const rows = (await legacy.table('patients').toArray()) as LegacyPatient[];
    legacy.close();

    for (const p of rows) {
      const input: PatientInput = {
        name: p.name,
        dateOfBirth: p.dateOfBirth ?? '',
        gender: 'unknown',
        bloodType: (BLOOD_TYPES as readonly string[]).includes(p.bloodType) ? (p.bloodType as BloodType) : 'Unknown',
        contactNumber: '',
        allergies: (p.allergies ?? []).map((a) => ({ allergen: a, severity: 'unknown', reaction: '' })),
        medications: (p.medications ?? []).map((m) => ({ name: m.name, dosage: m.dosage, frequency: '', startDate: '', endDate: '' })),
        newVitals: p.vitals && Object.values(p.vitals).some((v) => v !== undefined && v !== '') ? p.vitals : null,
      };
      await commitLocalEdit(p.id, (current) =>
        current
          ? []
          : [
              buildCreateMutation(p.id, input, {
                clientId: getClientId(),
                userId: session.user.id,
                userName: session.user.name,
                now: new Date().toISOString(),
                newId: () => crypto.randomUUID(),
              }),
            ],
      );
    }
    await setMeta('legacyImported', true);
    return rows.length;
  } catch {
    return 0;
  } finally {
    running = false;
  }
}

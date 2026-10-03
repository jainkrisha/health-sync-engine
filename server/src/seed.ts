/**
 * Seed demo users and sample patients.
 *
 *   npm run seed            # only if the database is empty
 *   npm run seed -- --reset # wipe everything first
 *
 * Every demo account uses the password "password123".
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { buildCreateMutation, buildUpdateMutations, type MutationContext, type PatientInput } from '@shared/diff';
import { materialize } from '@shared/materialize';
import { DISTRICT_FACILITY, type PatientDoc, type Role } from '@shared/types';
import { connectDb, disconnectDb } from './db';
import { config } from './config';
import { User } from './models/User';
import { processMutations } from './services/syncService';
import { loadDoc } from './services/patientStore';
import type { AuthUser } from './middleware/auth';

const DEMO_PASSWORD = 'password123';

const demoUsers: { username: string; name: string; role: Role; facility: string }[] = [
  { username: 'admin', name: 'Admin User', role: 'admin', facility: DISTRICT_FACILITY },
  { username: 'worker1', name: 'Dr. Priya (PHC Wagholi)', role: 'health_worker', facility: 'PHC Wagholi' },
  { username: 'worker2', name: 'Dr. Rahul (PHC Lonikand)', role: 'health_worker', facility: 'PHC Lonikand' },
  { username: 'reviewer', name: 'Dr. Mehta (Reviewer)', role: 'clinical_reviewer', facility: DISTRICT_FACILITY },
  { username: 'auditor', name: 'Audit Officer', role: 'auditor', facility: DISTRICT_FACILITY },
];

const patients: PatientInput[] = [
  {
    name: 'Asha Patil',
    dateOfBirth: '1984-03-12',
    gender: 'female',
    bloodType: 'B+',
    contactNumber: '9820012345',
    allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Hives, swelling' }],
    medications: [{ name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', startDate: '2026-06-01', endDate: '' }],
    newVitals: { heartRate: 78, bloodPressure: '128/84', temperature: 36.8, oxygenSaturation: 98 },
  },
  {
    name: 'Ramesh Jadhav',
    dateOfBirth: '1958-11-02',
    gender: 'male',
    bloodType: 'O+',
    contactNumber: '9930045678',
    allergies: [{ allergen: 'Sulfa drugs', severity: 'moderate', reaction: 'Rash' }],
    medications: [
      { name: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily', startDate: '2026-01-15', endDate: '' },
      { name: 'Aspirin', dosage: '75 mg', frequency: 'Once daily', startDate: '2026-01-15', endDate: '' },
    ],
    newVitals: { heartRate: 70, bloodPressure: '142/90', temperature: 36.6, respiratoryRate: 16 },
  },
  {
    name: 'Fatima Shaikh',
    dateOfBirth: '1997-07-21',
    gender: 'female',
    bloodType: 'A-',
    contactNumber: '9867001122',
    allergies: [],
    medications: [{ name: 'Iron + Folic Acid', dosage: '1 tablet', frequency: 'Once daily', startDate: '2026-08-10', endDate: '2026-11-10' }],
    newVitals: { heartRate: 88, bloodPressure: '110/70', temperature: 37.1 },
  },
  {
    name: 'Kiran More',
    dateOfBirth: '2016-02-05',
    gender: 'male',
    bloodType: 'AB+',
    contactNumber: '9819988776',
    allergies: [{ allergen: 'Peanuts', severity: 'severe', reaction: 'Anaphylaxis' }],
    medications: [],
    newVitals: { heartRate: 96, temperature: 38.4, respiratoryRate: 22 },
  },
];

function ctx(clientId: string, user: AuthUser, offsetMinutes: number): MutationContext {
  return {
    clientId,
    userId: user.userId,
    userName: user.name,
    now: new Date(Date.now() - offsetMinutes * 60_000).toISOString(),
    newId: randomUUID,
  };
}

function inputOf(doc: PatientDoc): PatientInput {
  const p = materialize(doc);
  return {
    name: p.name,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    bloodType: p.bloodType,
    contactNumber: p.contactNumber,
    allergies: p.allergies,
    medications: p.medications.map(({ openConflictIds: _ignored, ...m }) => m),
    newVitals: null,
  };
}

async function main() {
  await connectDb(config.mongoUri);
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    console.log('Database reset.');
  }
  if ((await User.countDocuments()) > 0) {
    console.log('Users already exist, skipping seed (use --reset to start over).');
    await disconnectDb();
    return;
  }

  const created: Record<string, AuthUser> = {};
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of demoUsers) {
    const doc = await User.create({ ...u, passwordHash });
    created[u.username] = { userId: doc._id, username: u.username, name: u.name, role: u.role, facility: u.facility };
  }

  const worker1 = created.worker1;
  const worker2 = created.worker2;
  const deviceA = 'seed-tablet-a';
  const deviceB = 'seed-tablet-b';

  const ids: string[] = [];
  for (const [i, p] of patients.entries()) {
    const id = randomUUID();
    ids.push(id);
    await processMutations([buildCreateMutation(id, p, ctx(deviceA, worker1, 600 - i * 10))], {
      user: worker1,
      clientId: deviceA,
      deviceName: 'PHC Wagholi tablet',
    });
  }

  // Demo: both tablets edited Asha's record while offline.
  const asha = (await loadDoc(ids[0]))!;
  const base = inputOf(asha);
  const fromA = buildUpdateMutations(
    asha,
    {
      ...base,
      allergies: [...base.allergies, { allergen: 'Latex', severity: 'mild', reaction: 'Itching' }],
      medications: [{ ...base.medications[0], dosage: '850 mg' }],
    },
    ctx(deviceA, worker1, 120),
  );
  const fromB = buildUpdateMutations(
    asha,
    {
      ...base,
      allergies: [...base.allergies, { allergen: 'Ibuprofen', severity: 'moderate', reaction: 'Stomach pain' }],
      medications: [{ ...base.medications[0], dosage: '1000 mg' }],
      newVitals: { heartRate: 82, bloodPressure: '132/86' },
    },
    ctx(deviceB, worker2, 90),
  );
  await processMutations(fromA, { user: worker1, clientId: deviceA, deviceName: 'PHC Wagholi tablet' });
  await processMutations(fromB, { user: worker2, clientId: deviceB, deviceName: 'PHC Lonikand tablet' });

  console.log(`Seeded ${demoUsers.length} users and ${patients.length} patients (1 pending medication conflict).`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"): ${demoUsers.map((u) => `${u.username} [${u.role}]`).join(', ')}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});

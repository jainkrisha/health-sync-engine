/**
 * Seed demo users and patients.
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
import synthea from './data/synthea-patients.json' with { type: 'json' };
import { connectDb, disconnectDb } from './db';
import { config } from './config';
import { User } from './models/User';
import { processMutations } from './services/syncService';
import { resolveConflict } from './services/conflictService';
import { ConflictModel } from './models/Conflict';
import { loadDoc } from './services/patientStore';
import type { AuthUser } from './middleware/auth';

const DEMO_PASSWORD = 'password123';

const demoUsers: { username: string; name: string; role: Role; facility: string }[] = [
  { username: 'admin', name: 'Admin User', role: 'admin', facility: DISTRICT_FACILITY },
  { username: 'worker1', name: 'Dr. Priya (PHC Wagholi)', role: 'health_worker', facility: 'PHC Wagholi' },
  { username: 'worker2', name: 'Dr. Rahul (PHC Lonikand)', role: 'health_worker', facility: 'PHC Lonikand' },
  { username: 'worker3', name: 'Dr. Kavita (PHC Hadapsar)', role: 'health_worker', facility: 'PHC Hadapsar' },
  { username: 'worker4', name: 'Dr. Imran (PHC Uruli Kanchan)', role: 'health_worker', facility: 'PHC Uruli Kanchan' },
  { username: 'worker5', name: 'Nurse Sunita (PHC Khed)', role: 'health_worker', facility: 'PHC Khed' },
  { username: 'reviewer', name: 'Dr. Mehta (Reviewer)', role: 'clinical_reviewer', facility: DISTRICT_FACILITY },
  { username: 'auditor', name: 'Audit Officer', role: 'auditor', facility: DISTRICT_FACILITY },
];

interface SeedVitals {
  recordedAt: string;
  heartRate?: number;
  bloodPressure?: string;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}
type SeedPatient = Omit<PatientInput, 'newVitals'> & { syntheaId: string; vitals: SeedVitals[] };

/**
 * Patients come from Synthea's sample records (see src/data/README.md and
 * scripts/import-synthea.mjs): real-world-shaped histories that belong to no
 * real person. Patients with medicines come first in the file.
 */
const patients = (synthea as unknown as { patients: SeedPatient[] }).patients;

const vitalsOf = ({ recordedAt: _at, ...v }: SeedVitals): PatientInput['newVitals'] => v;

/** "500 mg" -> ["1000 mg", "250 mg"]: two different doses a pair of tablets might type. */
function clashingDoses(dosage: string): [string, string] {
  const m = /^([\d.]+)\s*(.*)$/.exec(dosage);
  if (!m) return [`2 x ${dosage}`, `half of ${dosage}`];
  const n = Number(m[1]);
  const fmt = (x: number) => `${Math.round(x * 1000) / 1000} ${m[2]}`.trim();
  return [fmt(n * 2), fmt(n / 2)];
}

function ctx(clientId: string, user: AuthUser, offsetMinutes: number, at?: string): MutationContext {
  return {
    clientId,
    userId: user.userId,
    userName: user.name,
    now: at ? new Date(at).toISOString() : new Date(Date.now() - offsetMinutes * 60_000).toISOString(),
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

  // One tablet per PHC; patients are spread across them.
  const tablets = [
    { clientId: 'seed-tablet-a', user: created.worker1, name: 'PHC Wagholi tablet' },
    { clientId: 'seed-tablet-b', user: created.worker2, name: 'PHC Lonikand tablet' },
    { clientId: 'seed-tablet-c', user: created.worker3, name: 'PHC Hadapsar tablet' },
    { clientId: 'seed-tablet-d', user: created.worker4, name: 'PHC Uruli Kanchan tablet' },
    { clientId: 'seed-tablet-e', user: created.worker5, name: 'PHC Khed tablet' },
  ];
  type Tablet = (typeof tablets)[number];
  type Change = (b: PatientInput) => PatientInput;
  const push = async (t: Tablet, mutations: ReturnType<typeof buildUpdateMutations>) => {
    const { results } = await processMutations(mutations, { user: t.user, clientId: t.clientId, deviceName: t.name });
    for (const r of results) if (r.status === 'rejected') console.warn(`Seed edit rejected: ${r.reason}`);
  };

  // Each patient is registered at one PHC on the date of their first recorded
  // visit; later visits add their readings on the dates Synthea gives.
  const ids: string[] = [];
  for (const [i, p] of patients.entries()) {
    const id = randomUUID();
    ids.push(id);
    const t = tablets[i % tablets.length];
    const [first, ...later] = p.vitals;
    const { syntheaId: _sid, vitals: _v, ...input } = p;
    await push(t, [buildCreateMutation(id, { ...input, newVitals: vitalsOf(first) }, ctx(t.clientId, t.user, 0, first.recordedAt))]);
    for (const v of later) {
      const doc = (await loadDoc(id))!;
      await push(t, buildUpdateMutations(doc, { ...inputOf(doc), newVitals: vitalsOf(v) }, ctx(t.clientId, t.user, 0, v.recordedAt)));
    }
  }

  // The merge stories below happen today, on records that have medicines.
  const withMeds = patients.flatMap((p, i) => (p.medications.length ? [i] : []));
  const story = (k: number) => withMeds[k % withMeds.length];
  const doses = (i: number) => clashingDoses(patients[i].medications[0].dosage);

  /** One tablet edits the latest copy of the record. */
  const visit = async (i: number, t: Tablet, minutesAgo: number, change: Change) => {
    const doc = (await loadDoc(ids[i]))!;
    await push(t, buildUpdateMutations(doc, change(inputOf(doc)), ctx(t.clientId, t.user, minutesAgo)));
  };
  /** Two tablets edit the same copy while offline, then both sync. */
  const offlinePair = async (i: number, one: [Tablet, number, Change], two: [Tablet, number, Change]) => {
    const doc = (await loadDoc(ids[i]))!;
    const base = inputOf(doc);
    const a = buildUpdateMutations(doc, one[2](base), ctx(one[0].clientId, one[0].user, one[1]));
    const b = buildUpdateMutations(doc, two[2](base), ctx(two[0].clientId, two[0].user, two[1]));
    await push(one[0], a);
    await push(two[0], b);
  };
  const vitals = (v: PatientInput['newVitals']): Change => (b) => ({ ...b, newVitals: v });
  const allergy = (allergen: string, severity: 'mild' | 'moderate' | 'severe', reaction: string): Change => (b) => ({
    ...b,
    allergies: [...b.allergies, { allergen, severity, reaction }],
  });
  const firstDose = (dosage: string, frequency?: string): Change => (b) => ({
    ...b,
    medications: [{ ...b.medications[0], dosage, frequency: frequency ?? b.medications[0].frequency }, ...b.medications.slice(1)],
  });
  const [wagholi, lonikand, hadapsar, uruli, khed] = tablets;

  // Seen at a second PHC: that PHC records vitals, then the home PHC updates
  // the phone number having seen the visit.
  await visit(story(0), lonikand, 470, vitals({ heartRate: 78, bloodPressure: '128/84', temperature: 36.8 }));
  await visit(story(0), wagholi, 430, (b) => ({ ...b, contactNumber: '98220 11223' }));

  // Two PHCs add different allergies offline (both kept), one records vitals
  // having seen both, and later both change the same dose.
  await offlinePair(story(1), [wagholi, 460, allergy('Sulfa drugs', 'moderate', 'Rash')], [hadapsar, 455, allergy('Shellfish', 'severe', 'Swelling')]);
  await visit(story(1), hadapsar, 400, vitals({ heartRate: 74, bloodPressure: '142/90', oxygenSaturation: 97 }));
  await offlinePair(story(1), [wagholi, 330, firstDose(doses(story(1))[0])], [hadapsar, 320, firstDose(doses(story(1))[1])]);

  // Two phone numbers typed offline (the later one wins), then two doses.
  await offlinePair(story(2), [wagholi, 450, (b) => ({ ...b, contactNumber: '90110 44556' })], [uruli, 440, (b) => ({ ...b, contactNumber: '90110 44665' })]);
  await visit(story(2), uruli, 380, vitals({ heartRate: 88, bloodPressure: '110/72', temperature: 37.1 }));
  await offlinePair(story(2), [uruli, 300, firstDose(doses(story(2))[0])], [khed, 290, firstDose(doses(story(2))[1], 'Twice daily')]);

  // Vitals from two health camps on the same day: both readings are kept.
  await offlinePair(story(3), [lonikand, 465, vitals({ heartRate: 92, temperature: 38.4 })], [khed, 460, vitals({ heartRate: 90, temperature: 38.2, oxygenSaturation: 96 })]);
  await visit(story(3), khed, 350, allergy('Dust', 'mild', 'Sneezing'));

  // Both tablets edited one record while offline: different allergies (both
  // kept), different doses of the same medicine (sent to review), and vitals.
  const demo = story(0);
  const record = (await loadDoc(ids[demo]))!;
  const base = inputOf(record);
  const [doseA, doseB] = doses(demo);
  await push(
    wagholi,
    buildUpdateMutations(
      record,
      {
        ...base,
        allergies: [...base.allergies, { allergen: 'Latex', severity: 'mild', reaction: 'Itching' }],
        medications: [{ ...base.medications[0], dosage: doseA }, ...base.medications.slice(1)],
      },
      ctx(wagholi.clientId, wagholi.user, 120),
    ),
  );
  await push(
    lonikand,
    buildUpdateMutations(
      record,
      {
        ...base,
        allergies: [...base.allergies, { allergen: 'Ibuprofen', severity: 'moderate', reaction: 'Stomach pain' }],
        medications: [{ ...base.medications[0], dosage: doseB }, ...base.medications.slice(1)],
        newVitals: { heartRate: 82, bloodPressure: '132/86' },
      },
      ctx(lonikand.clientId, lonikand.user, 90),
    ),
  );

  // More review cases: a follow-up visit, then two tablets change the same dose
  // while both are offline.
  for (let k = 4; k < 10; k++) {
    const i = story(k);
    await visit(i, tablets[(k + 2) % tablets.length], 420 - k * 12, vitals({ heartRate: 70 + k * 3, bloodPressure: `${120 + k * 4}/${78 + k}` }));
    const one = tablets[(k + 1) % tablets.length];
    const two = tablets[(k + 3) % tablets.length];
    await offlinePair(i, [one, 80 - k * 7, firstDose(doses(i)[0])], [two, 70 - k * 7, firstDose(doses(i)[1])]);
  }

  // A reviewer has already settled two of the dose clashes.
  const reviewer = created.reviewer;
  const settle = async (i: number, choice: 'current' | 'incoming' | 'custom', note: string, value?: { dosage: string; frequency: string; active: boolean }) => {
    const row = await ConflictModel.findOne({ patientId: ids[i], status: 'pending_review' }).lean();
    if (row) await resolveConflict(String(row._id), { choice, note, value }, reviewer);
  };
  await settle(story(1), 'incoming', 'BP still high on the lower dose at review; keep the Hadapsar dose.');
  await settle(story(2), 'custom', 'Agreed with the medical officer by phone.', {
    dosage: patients[story(2)].medications[0].dosage,
    frequency: 'Twice daily',
    active: true,
  });

  const open = await ConflictModel.countDocuments({ status: 'pending_review' });
  console.log(`Seeded ${demoUsers.length} users and ${patients.length} patients from Synthea (${open} pending medication conflicts, 2 already resolved).`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"): ${demoUsers.map((u) => `${u.username} [${u.role}]`).join(', ')}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});

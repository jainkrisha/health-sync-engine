/**
 * Turns Synthea's sample patient records (CSV export) into the patient list the
 * seed script loads.
 *
 *   node scripts/import-synthea.mjs <folder with patients.csv, allergies.csv,
 *                                    medications.csv, observations.csv>
 *
 * Source: Synthea sample data, "synthea_sample_data_csv_latest.zip" from
 * https://synthea.mitre.org/downloads (Apache-2.0). Synthea records are
 * realistic but belong to no real person, so they are safe to demo and share.
 *
 * What comes from Synthea: date of birth, sex, allergies (allergen, reaction,
 * severity), current medications with their strength and start date, and up to
 * three vital-sign readings per patient with their real visit dates.
 *
 * What is localised here, because Synthea generates US people: names (common
 * Maharashtra names), 10-digit Indian mobile numbers, and blood group (Synthea
 * does not record one; it is drawn from the ABO/Rh mix reported for India).
 * Each is chosen from a hash of the Synthea patient id, so a re-run gives the
 * same file. Usual dosing frequencies are filled in from a table below, since
 * Synthea does not record them.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-synthea.mjs <synthea csv folder>');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'synthea-patients.json');

// ── CSV ──────────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n') row.push(field), rows.push(row), (row = []), (field = '');
    else if (c !== '\r') field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const read = (name) => parseCsv(readFileSync(join(src, `${name}.csv`), 'utf8'));

// ── Deterministic choices ────────────────────────────────────────────────────
const hash = (id, salt) => createHash('sha256').update(`${salt}:${id}`).digest().readUInt32BE(0);
const pick = (list, id, salt) => list[hash(id, salt) % list.length];

const FEMALE = ['Asha', 'Lata', 'Meera', 'Kavita', 'Priya', 'Sunita', 'Sunanda', 'Savita', 'Anita', 'Pooja', 'Neha', 'Sneha',
  'Sanjana', 'Shalini', 'Rekha', 'Usha', 'Vandana', 'Jyoti', 'Archana', 'Manisha', 'Nirmala', 'Shobha', 'Kalpana', 'Swati',
  'Geeta', 'Radha', 'Aarti', 'Rupali', 'Smita', 'Vaishali', 'Suman', 'Pallavi', 'Sangita', 'Bharati'];
const MALE = ['Ramesh', 'Kiran', 'Sunil', 'Prakash', 'Ganesh', 'Rahul', 'Anil', 'Sanjay', 'Suresh', 'Mahesh', 'Rajesh', 'Vijay',
  'Rohit', 'Amit', 'Nikhil', 'Rohan', 'Vikram', 'Santosh', 'Dilip', 'Ashok', 'Vinod', 'Mohan', 'Shankar', 'Nitin', 'Sachin',
  'Tukaram', 'Vitthal', 'Arjun', 'Aditya', 'Sagar', 'Prashant', 'Manoj', 'Deepak', 'Dattatray'];
const SURNAMES = ['Patil', 'Bhosale', 'More', 'Pawar', 'Kulkarni', 'Shinde', 'Jadhav', 'Gaikwad', 'Deshpande', 'Chavan', 'Kale',
  'Mane', 'Kadam', 'Kamble', 'Salunkhe', 'Jagtap', 'Sawant', 'Deshmukh', 'Joshi', 'Wagh', 'Gawade', 'Lokhande', 'Dhumal',
  'Kharat', 'Shirke', 'Satpute', 'Tambe', 'Kolhe', 'Nimbalkar'];
// About one patient in eight gets a Muslim name, as in the Pune district census mix.
const FEMALE_M = ['Fatima', 'Rukhsana', 'Ayesha', 'Shabana', 'Nasreen', 'Zainab'];
const MALE_M = ['Imran', 'Salim', 'Javed', 'Irfan', 'Asif', 'Rashid'];
const SURNAMES_M = ['Shaikh', 'Pathan', 'Khan', 'Mulla', 'Sayyed', 'Inamdar'];

// India's ABO/Rh mix, rounded (percent).
const BLOOD = [['B+', 32], ['O+', 31], ['A+', 22], ['AB+', 8], ['O-', 2], ['B-', 2], ['A-', 2], ['AB-', 1]];
function bloodType(id) {
  let n = hash(id, 'blood') % 100;
  for (const [type, pct] of BLOOD) {
    if (n < pct) return type;
    n -= pct;
  }
  return 'O+';
}

function localName(id, gender) {
  const muslim = hash(id, 'community') % 8 === 0;
  const first = pick(gender === 'female' ? (muslim ? FEMALE_M : FEMALE) : muslim ? MALE_M : MALE, id, 'first');
  return `${first} ${pick(muslim ? SURNAMES_M : SURNAMES, id, 'last')}`;
}

function mobile(id) {
  const n = String(hash(id, 'phone') % 1_000_000_000).padStart(9, '0');
  return `${pick(['9', '8', '7'], id, 'prefix')}${n.slice(0, 4)} ${n.slice(4)}`;
}

// ── Allergies ────────────────────────────────────────────────────────────────
const clean = (s) => s.replace(/\s*\((substance|organism|edible|finding|disorder|situation)\)/g, '').trim();
const REACTIONS = {
  'Eruption of skin': 'Skin rash',
  Wheal: 'Hives',
  'Allergic angioedema': 'Swelling',
  'Finding of vomiting': 'Vomiting',
  Dyspnea: 'Breathing difficulty',
  'Cutaneous hypersensitivity': 'Skin reaction',
  'Nasal discharge present': 'Runny nose',
  'Abdominal pain': 'Stomach pain',
  Rhinoconjunctivitis: 'Runny nose, watery eyes',
};
const ALLERGENS = { 'Eggs': 'Eggs', "Cow's milk": 'Milk', 'Penicillin V': 'Penicillin', 'House dust mite': 'Dust mite', 'Mold': 'Mould' };

// ── Medications ──────────────────────────────────────────────────────────────
const UNITS = { MG: 'mg', 'MG/ML': 'mg/mL', 'MG/ACTUAT': 'mg/puff', 'UNT/ML': 'units/mL', 'MG/HR': 'mg/hr', ML: 'mL' };
/** Usual frequency by medicine (first match wins). */
const FREQUENCY = [
  [/alendron/i, 'Once weekly'],
  [/vitamin b12/i, 'Once monthly'],
  [/epinephrine/i, 'As needed (emergency)'],
  [/nitroglycerin/i, 'As needed for chest pain'],
  [/albuterol|salbutamol/i, 'As needed'],
  [/fluticasone|budesonide/i, 'Twice daily'],
  [/carvedilol|doxycycline/i, 'Twice daily'],
  [/insulin/i, 'Twice daily before meals'],
  [/naproxen|ibuprofen|acetaminophen|tramadol|oxycodone|hydrocodone|codeine|meperidine|chlorpheniramine/i, 'As needed for pain'],
  [/clonazepam/i, 'At bedtime'],
  [/fentanyl/i, 'Every 3 days (patch)'],
  [/hydrocortisone/i, 'Twice daily (apply)'],
  [/nuvaring|vaginal system/i, 'Monthly'],
  [/.*/, 'Once daily'],
];
const DISPLAY = [
  [/chlorpheniramine/i, 'As needed'],
];

const title = (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function medication(description) {
  // Contraceptive packs: "{...} Pack [Trinessa 28 Day]"
  if (description.startsWith('{')) {
    const pack = /\[(.+?)(\s+\d+\s+Day)?\]/.exec(description);
    return { name: pack ? `Oral contraceptive (${pack[1].trim()})` : 'Oral contraceptive', dosage: '1 tablet', frequency: 'Once daily' };
  }
  if (/vaginal system/i.test(description)) return { name: 'Contraceptive ring (NuvaRing)', dosage: '1 ring', frequency: 'Monthly' };
  const body = description
    .replace(/\[.*?\]/g, '')
    .replace(/^(Abuse-Deterrent\s+|\d+\s+(HR|DAY|ACTUAT)\s+|NDA\d+\s+|\d+(\.\d+)?\s+ML\s+)*/i, '')
    .trim();
  // First ingredient and its strength: "metoprolol succinate 100 MG Extended Release Oral Tablet"
  const m = /^(.+?)\s+([\d.]+)\s+(MG\/ML|MG\/ACTUAT|UNT\/ML|MG\/HR|MG|ML)\b/i.exec(body);
  if (!m) return null;
  let name = title(m[1].replace(/\s+hydrochloride|\s+hyclate|\s+sodium|\s+calcium|\s+potassium|\s+succinate|\s+bitartrate|\s+maleate|\s+propionate/gi, ''));
  const combo = / \/ ([a-z ]+?) [\d.]+ MG/i.exec(body);
  if (combo) name = `${name} + ${title(combo[1].replace(/\s+(hydrochloride|bitartrate|phosphate)/gi, ''))}`;
  name = name.replace(/^Amlodipine$/i, 'Amlodipine').replace(/^Insulin Isophane\s+Human$/i, 'Insulin (Humulin 70/30)');
  // Strengths under 1 mg read better in micrograms: 0.075 mg -> 75 mcg.
  const strength = Number(m[2]);
  const unit = UNITS[m[3].toUpperCase()] ?? m[3].toLowerCase();
  const dosage = strength < 1 && unit.startsWith('mg') ? `${Math.round(strength * 1000 * 100) / 100} ${unit.replace('mg', 'mcg')}` : `${strength} ${unit}`;
  const frequency = (DISPLAY.find(([re]) => re.test(description)) ?? FREQUENCY.find(([re]) => re.test(description)))[1];
  return { name, dosage, frequency };
}

// ── Vitals ───────────────────────────────────────────────────────────────────
const VITAL_CODES = {
  '8867-4': 'heartRate',
  '8480-6': 'systolic',
  '8462-4': 'diastolic',
  '8310-5': 'temperature',
  '9279-1': 'respiratoryRate',
  '2708-6': 'oxygenSaturation',
  '59408-5': 'oxygenSaturation',
};

// ── Build ────────────────────────────────────────────────────────────────────
const people = read('patients').filter((p) => !p.DEATHDATE);
const ids = new Set(people.map((p) => p.Id));

const allergies = new Map();
for (const a of read('allergies')) {
  if (!ids.has(a.PATIENT) || a.STOP || /Allergic disposition/i.test(a.DESCRIPTION)) continue;
  const allergen = ALLERGENS[clean(a.DESCRIPTION)] ?? clean(a.DESCRIPTION);
  const reaction = a.DESCRIPTION1 ? (REACTIONS[clean(a.DESCRIPTION1)] ?? clean(a.DESCRIPTION1)) : '';
  const severity = (a.SEVERITY1 || 'unknown').toLowerCase();
  const list = allergies.get(a.PATIENT) ?? [];
  if (!list.some((x) => x.allergen.toLowerCase() === allergen.toLowerCase())) list.push({ allergen, severity, reaction });
  allergies.set(a.PATIENT, list);
}

const meds = new Map();
for (const m of read('medications')) {
  if (!ids.has(m.PATIENT) || m.STOP) continue;
  const med = medication(m.DESCRIPTION);
  if (!med) continue;
  const list = meds.get(m.PATIENT) ?? [];
  const existing = list.find((x) => x.name.toLowerCase() === med.name.toLowerCase());
  const startDate = m.START.slice(0, 10);
  if (existing) {
    if (startDate > existing.startDate) Object.assign(existing, med, { startDate });
  } else list.push({ ...med, startDate, endDate: '' });
  meds.set(m.PATIENT, list);
}

const visits = new Map();
for (const o of read('observations')) {
  const key = VITAL_CODES[o.CODE];
  if (!key || !ids.has(o.PATIENT)) continue;
  const byDate = visits.get(o.PATIENT) ?? new Map();
  const v = byDate.get(o.DATE) ?? {};
  v[key] = Number(o.VALUE);
  byDate.set(o.DATE, v);
  visits.set(o.PATIENT, byDate);
}

function readings(id) {
  const byDate = visits.get(id);
  if (!byDate) return [];
  return [...byDate.entries()]
    .filter(([, v]) => v.heartRate !== undefined || v.systolic !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3)
    .map(([at, v]) => {
      const r = { recordedAt: at };
      if (v.heartRate !== undefined) r.heartRate = Math.round(v.heartRate);
      if (v.systolic !== undefined && v.diastolic !== undefined) r.bloodPressure = `${Math.round(v.systolic)}/${Math.round(v.diastolic)}`;
      if (v.temperature !== undefined) r.temperature = Math.round(v.temperature * 10) / 10;
      if (v.respiratoryRate !== undefined) r.respiratoryRate = Math.round(v.respiratoryRate);
      if (v.oxygenSaturation !== undefined) r.oxygenSaturation = Math.round(v.oxygenSaturation);
      return r;
    });
}

const usedNames = new Set();
const patients = people
  .map((p) => {
    const gender = p.GENDER === 'F' ? 'female' : 'male';
    let name = localName(p.Id, gender);
    for (let n = 2; usedNames.has(name); n++) name = localName(`${p.Id}#${n}`, gender);
    usedNames.add(name);
    return {
      syntheaId: p.Id,
      name,
      dateOfBirth: p.BIRTHDATE,
      gender,
      bloodType: bloodType(p.Id),
      contactNumber: mobile(p.Id),
      allergies: allergies.get(p.Id) ?? [],
      medications: (meds.get(p.Id) ?? []).sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5),
      vitals: readings(p.Id),
    };
  })
  .filter((p) => p.vitals.length > 0)
  // Patients with medicines first, so the demo's review cases have doses to clash on.
  .sort((a, b) => b.medications.length - a.medications.length || a.dateOfBirth.localeCompare(b.dateOfBirth));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      source: 'Synthea sample data (synthea_sample_data_csv_latest.zip), https://synthea.mitre.org/downloads, Apache-2.0',
      note: 'Clinical details are from Synthea. Names, phone numbers and blood groups are localised by scripts/import-synthea.mjs.',
      patients,
    },
    null,
    1,
  )}\n`,
);
const count = (f) => patients.reduce((n, p) => n + p[f].length, 0);
console.log(`Wrote ${patients.length} patients (${count('allergies')} allergies, ${count('medications')} medications, ${count('vitals')} readings) to ${out}`);

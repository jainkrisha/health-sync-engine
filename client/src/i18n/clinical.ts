/**
 * clinical.ts — Hindi for common values typed into patient records: dose
 * frequencies, allergy reactions and dose units ("Twice daily", "Rash",
 * "2 tablets"). Only the display changes; the record keeps what was entered.
 * Anything not recognised (medicine names, unusual phrasing) is shown as typed.
 */
import { getLang } from './i18n';

const PHRASES: Record<string, string> = {
  'once daily': 'दिन में एक बार',
  'twice daily': 'दिन में दो बार',
  'three times daily': 'दिन में तीन बार',
  'four times daily': 'दिन में चार बार',
  'once a day': 'दिन में एक बार',
  'twice a day': 'दिन में दो बार',
  'as needed': 'ज़रूरत होने पर',
  'at night': 'रात में',
  'at bedtime': 'सोते समय',
  'every morning': 'हर सुबह',
  'in the morning': 'सुबह',
  'before meals': 'खाने से पहले',
  'after meals': 'खाने के बाद',
  'with meals': 'खाने के साथ',
  weekly: 'हफ़्ते में एक बार',
  daily: 'रोज़',
  od: 'दिन में एक बार',
  bd: 'दिन में दो बार',
  tds: 'दिन में तीन बार',
  sos: 'ज़रूरत होने पर',
  anaphylaxis: 'एनाफ़िलेक्सिस (गंभीर एलर्जी)',
  hives: 'पित्ती',
  swelling: 'सूजन',
  itching: 'खुजली',
  nausea: 'मतली',
  vomiting: 'उल्टी',
  rash: 'चकत्ते',
  sneezing: 'छींक',
  'stomach pain': 'पेट दर्द',
  wheezing: 'घरघराहट',
  'breathing difficulty': 'साँस लेने में तकलीफ़',
  'shortness of breath': 'साँस फूलना',
  diarrhoea: 'दस्त',
  diarrhea: 'दस्त',
  headache: 'सिरदर्द',
  dizziness: 'चक्कर',
  fever: 'बुख़ार',
  cough: 'खाँसी',
};

const UNITS: Record<string, string> = {
  tablet: 'गोली',
  tablets: 'गोलियाँ',
  tab: 'गोली',
  tabs: 'गोलियाँ',
  capsule: 'कैप्सूल',
  capsules: 'कैप्सूल',
  puff: 'पफ़',
  puffs: 'पफ़',
  drop: 'बूँद',
  drops: 'बूँदें',
  unit: 'यूनिट',
  units: 'यूनिट',
  injection: 'इंजेक्शन',
  sachet: 'पाउच',
};

function segment(part: string): string {
  const key = part.trim().toLowerCase();
  if (!key) return part;
  if (PHRASES[key]) return PHRASES[key];
  let m = /^every (\d+) hours?$/.exec(key);
  if (m) return `हर ${m[1]} घंटे`;
  m = /^([\d.½¼/]+)\s*([a-z]+)$/.exec(key);
  if (m && UNITS[m[2]]) return `${m[1]} ${UNITS[m[2]]}`;
  return part.trim();
}

/** A dose, frequency or reaction as entered, in the current language. */
export function tValue(value: string | undefined | null): string {
  if (!value || getLang() === 'en') return value ?? '';
  return value
    .split(',')
    .map((p) => segment(p))
    .join(', ');
}

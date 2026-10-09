/**
 * names.ts — names (patients, staff, PHCs, medicines, allergens) written in
 * Devanagari when Hindi is on. Only the display changes; records, search and
 * sync keep the name exactly as entered.
 *
 * Known words come from a word list, so common names and medicines read the way
 * they are spoken; anything else is transliterated by sound from its Roman
 * spelling. That fallback is a best guess (English spelling does not say whether
 * "t" is त or ट), so a wrong spelling is fixed by adding the word to WORDS.
 */
import { getLang } from './i18n';

/** Whole words, lower case. */
const WORDS: Record<string, string> = {
  // titles and common words in names
  dr: 'डॉ', 'dr.': 'डॉ.', mr: 'श्री', 'mr.': 'श्री', mrs: 'श्रीमती', 'mrs.': 'श्रीमती', ms: 'सुश्री', 'ms.': 'सुश्री',
  nurse: 'नर्स', phc: 'पीएचसी', tablet: 'टैबलेट', reviewer: 'समीक्षक', admin: 'एडमिन', user: 'यूज़र', audit: 'ऑडिट',
  officer: 'अधिकारी', district: 'ज़िला', hospital: 'अस्पताल', and: 'और', inhaler: 'इनहेलर', drugs: 'दवाएँ', acid: 'एसिड',
  // people
  asha: 'आशा', patil: 'पाटिल', fatima: 'फ़ातिमा', shaikh: 'शेख़', ganesh: 'गणेश', bhosale: 'भोसले', kiran: 'किरण',
  more: 'मोरे', lata: 'लता', pawar: 'पवार', meera: 'मीरा', kulkarni: 'कुलकर्णी', prakash: 'प्रकाश', shinde: 'शिंदे',
  ramesh: 'रमेश', jadhav: 'जाधव', rukhsana: 'रुख़साना', pathan: 'पठान', sunil: 'सुनील', gaikwad: 'गायकवाड़',
  imran: 'इमरान', kavita: 'कविता', mehta: 'मेहता', priya: 'प्रिया', rahul: 'राहुल', sunita: 'सुनीता', shah: 'शाह',
  rao: 'राव', anil: 'अनिल', sanjay: 'संजय', suresh: 'सुरेश', mahesh: 'महेश', rajesh: 'राजेश', vijay: 'विजय',
  sunanda: 'सुनंदा', savita: 'सविता', anita: 'अनीता', pooja: 'पूजा', neha: 'नेहा', rohit: 'रोहित', amit: 'अमित',
  deshpande: 'देशपांडे', chavan: 'चव्हाण', thakur: 'ठाकुर', kale: 'काळे', mane: 'माने', kadam: 'कदम',
  bhattacharya: 'भट्टाचार्य', gokhale: 'गोखले', kamble: 'कांबळे', salunkhe: 'साळुंखे', jagtap: 'जगताप', sawant: 'सावंत',
  nikhil: 'निखिल', sneha: 'स्नेहा', rohan: 'रोहन', vikram: 'विक्रम', sanjana: 'संजना', yash: 'यश',
  deshmukh: 'देशमुख', joshi: 'जोशी', sharma: 'शर्मा', singh: 'सिंह', khan: 'ख़ान', yadav: 'यादव', gupta: 'गुप्ता',
  // places
  wagholi: 'वाघोली', lonikand: 'लोणीकंद', hadapsar: 'हडपसर', khed: 'खेड', uruli: 'उरुळी', kanchan: 'कांचन',
  pune: 'पुणे', haveli: 'हवेली', shirur: 'शिरूर', baramati: 'बारामती',
  // medicines
  amlodipine: 'एम्लोडिपिन', amoxicillin: 'एमोक्सिसिलिन', aspirin: 'एस्पिरिन', atenolol: 'एटेनोलोल', insulin: 'इंसुलिन',
  glargine: 'ग्लार्जिन', iron: 'आयरन', folic: 'फ़ोलिक', levothyroxine: 'लेवोथायरोक्सिन', losartan: 'लोसार्टन',
  metformin: 'मेटफ़ॉर्मिन', paracetamol: 'पैरासिटामोल', salbutamol: 'साल्बुटामोल', ibuprofen: 'आइबुप्रोफ़ेन',
  penicillin: 'पेनिसिलिन', codeine: 'कोडीन', sulfa: 'सल्फ़ा', azithromycin: 'एज़िथ्रोमाइसिन', cetirizine: 'सेटिरिज़िन',
  omeprazole: 'ओमेप्राज़ोल', pantoprazole: 'पैंटोप्राज़ोल', glimepiride: 'ग्लिमेपिराइड', telmisartan: 'टेल्मिसार्टन',
  // allergens
  dust: 'धूल', latex: 'लेटेक्स', peanuts: 'मूँगफली', peanut: 'मूँगफली', shellfish: 'शेलफ़िश', pollen: 'परागकण',
  milk: 'दूध', egg: 'अंडा', eggs: 'अंडे', wheat: 'गेहूँ',
};

// ── Fallback: transliterate by sound ─────────────────────────────────────────
const CONS: [string, string][] = [
  ['ksh', 'क्ष'], ['chh', 'छ'], ['shr', 'श्र'], ['ch', 'च'], ['sh', 'श'], ['kh', 'ख'], ['gh', 'घ'], ['th', 'थ'],
  ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['jh', 'झ'], ['ng', 'ं'], ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['t', 'त'],
  ['d', 'द'], ['n', 'न'], ['p', 'प'], ['f', 'फ़'], ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'],
  ['v', 'व'], ['w', 'व'], ['s', 'स'], ['h', 'ह'], ['z', 'ज़'], ['q', 'क'], ['x', 'क्स'],
];
// [roman, independent vowel, matra]
const VOWELS: [string, string, string][] = [
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ea', 'ई', 'ी'], ['oo', 'ऊ', 'ू'],
  ['ou', 'औ', 'ौ'], ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो'], ['y', 'ई', 'ी'],
];

function soundOut(word: string): string {
  const w = word.toLowerCase();
  let out = '';
  let afterConsonant = false;
  let i = 0;
  while (i < w.length) {
    // "c" is स before e/i/y, क otherwise
    if (w[i] === 'c' && w[i + 1] !== 'h') {
      const soft = /[eiy]/.test(w[i + 1] ?? '');
      if (afterConsonant) out += '्';
      out += soft ? 'स' : 'क';
      afterConsonant = true;
      i += w[i + 1] === 'k' ? 2 : 1;
      continue;
    }
    // "y" is a vowel only after a consonant and before another consonant or the end: Shelly, but Priya.
    const v = VOWELS.find(([r]) => w.startsWith(r, i) && (r !== 'y' || (afterConsonant && !/[aeiou]/.test(w[i + 1] ?? ''))));
    if (v) {
      const [r, full, matra] = v;
      const last = i + r.length >= w.length;
      if (afterConsonant) {
        // A final "a" in a name is usually long: Asha, Meera.
        out += r === 'a' && last && w.length > 2 ? 'ा' : matra;
      } else out += full;
      afterConsonant = false;
      i += r.length;
      continue;
    }
    // n or m before another consonant after a vowel is a nasal sign: Sanjana, Champa.
    if ((w[i] === 'n' || w[i] === 'm') && !afterConsonant && out && /[bcdfgjklpqstvz]/.test(w[i + 1] ?? '')) {
      out += 'ं';
      i += 1;
      continue;
    }
    const c = CONS.find(([r]) => w.startsWith(r, i));
    if (c) {
      if (c[1] === 'ं') {
        out += afterConsonant ? 'ं' : 'ङ';
        afterConsonant = false;
      } else {
        // Two of the same consonant read as one: "ll" in Amoxicillin.
        if (afterConsonant && w[i - 1] === w[i]) {
          i += 1;
          continue;
        }
        if (afterConsonant) out += '्';
        out += c[1];
        afterConsonant = true;
      }
      i += c[0].length;
      continue;
    }
    out += w[i];
    afterConsonant = false;
    i += 1;
  }
  return out;
}

function word(w: string): string {
  const key = w.toLowerCase();
  if (WORDS[key]) return WORDS[key];
  // Short all-caps words are acronyms; leave them.
  if (/^[A-Z]{2,4}$/.test(w)) return w;
  return soundOut(w);
}

/** A name in the current language. */
export function tName(name: string | undefined | null): string {
  if (!name || getLang() === 'en') return name ?? '';
  return name.replace(/[A-Za-z]+\.?/g, (m) => {
    if (m.endsWith('.') && WORDS[m.toLowerCase()]) return WORDS[m.toLowerCase()];
    const dot = m.endsWith('.') ? '.' : '';
    return word(dot ? m.slice(0, -1) : m) + dot;
  });
}

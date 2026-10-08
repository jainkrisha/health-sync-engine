/**
 * reports.ts — Hindi for the merge reports stored in the audit trail.
 *
 * Reports are written in English by shared/mergeEngine.ts when a change is merged
 * and saved with the audit entry, so they are translated when shown rather than
 * when written. Patients' own values (names, doses) stay as recorded. A report
 * that matches none of these shapes is shown in English.
 */
import { getLang, t } from './i18n';

const REASONS: Record<string, string> = {
  'newer write': 'नया बदलाव',
  'already applied': 'पहले ही लागू',
  'older write, the stored value is newer': 'पुराना बदलाव, सहेजा गया मान नया है',
  'concurrent write with the same value': 'एक साथ बदलाव, मान वही है',
  'concurrent edit, kept the incoming value (newer timestamp)': 'एक साथ संपादन, आया हुआ मान रखा गया (नया समय)',
  'concurrent edit, kept the stored value (newer timestamp)': 'एक साथ संपादन, सहेजा गया मान रखा गया (नया समय)',
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const R = `(${Object.keys(REASONS).map(esc).join('|')})`;

/** A value as describe() wrote it: "(empty)", "stopped (500mg, daily)", or as recorded. */
function value(v: string): string {
  if (v === '(empty)') return '(खाली)';
  const stopped = /^stopped \((.*)\)$/.exec(v);
  if (stopped) return `बंद (${stopped[1] === 'no dose' ? 'कोई खुराक नहीं' : stopped[1]})`;
  return v;
}
const reason = (r: string) => REASONS[r] ?? r;
const field = (f: string) => t(f);

type Rule = [RegExp, (m: string[]) => string];

const RULES: Rule[] = [
  [new RegExp(`^(.+?): resolved via Last-Write-Wins, set to (.+) \\(${R}\\)\\.$`), (m) => `${field(m[1])}: लास्ट-राइट-विन्स से तय, मान ${value(m[2])} किया गया (${reason(m[3])})।`],
  [new RegExp(`^(.+?): resolved via Last-Write-Wins, kept (.+) \\(${R}\\)\\.$`), (m) => `${field(m[1])}: लास्ट-राइट-विन्स से तय, ${value(m[2])} ही रखा गया (${reason(m[3])})।`],
  [/^Allergies: added "(.+)" \(OR-Set add\)\.$/, (m) => `एलर्जी: "${m[1]}" जोड़ी गई (OR-Set जोड़)।`],
  [new RegExp(`^Allergies: updated "(.+)" details \\(${R}\\)\\.$`), (m) => `एलर्जी: "${m[1]}" का विवरण बदला गया (${reason(m[2])})।`],
  [new RegExp(`^Allergies: "(.+)" already recorded, union kept every entry \\(${R}\\)\\.$`), (m) => `एलर्जी: "${m[1]}" पहले से दर्ज है, हर प्रविष्टि रखी गई (${reason(m[2])})।`],
  [/^Allergies: remove of "(.+)" ignored, it was never recorded here\.$/, (m) => `एलर्जी: "${m[1]}" को हटाने का अनुरोध अनदेखा किया गया, यह यहाँ कभी दर्ज नहीं थी।`],
  [
    /^Allergies: remove of "(.+)" did not apply because another device added or updated it concurrently \(add-wins, never-lose rule\)\.$/,
    (m) => `एलर्जी: "${m[1]}" नहीं हटाई गई क्योंकि दूसरे डिवाइस ने इसे उसी समय जोड़ा या बदला (जोड़ना जीतता है, कुछ नहीं खोता)।`,
  ],
  [/^Allergies: "(.+)" removed by explicit user action\.$/, (m) => `एलर्जी: "${m[1]}" उपयोगकर्ता ने हटाई।`],
  [new RegExp(`^Medications: "(.+)" schedule dates resolved via Last-Write-Wins \\(${R}\\)\\.$`), (m) => `दवाएँ: "${m[1]}" की तारीखें लास्ट-राइट-विन्स से तय की गईं (${reason(m[2])})।`],
  [/^Medications: "(.+)" added at (.+) \(sequential edit, no conflict\)\.$/, (m) => `दवाएँ: "${m[1]}" ${value(m[2])} पर जोड़ी गई (क्रम से बदलाव, कोई टकराव नहीं)।`],
  [/^Medications: "(.+)" changed from (.+) to (.+) \(sequential edit, no conflict\)\.$/, (m) => `दवाएँ: "${m[1]}" ${value(m[2])} से बदलकर ${value(m[3])} की गई (क्रम से बदलाव, कोई टकराव नहीं)।`],
  [/^Medications: "(.+)" stopped \(sequential edit, no conflict\)\.$/, (m) => `दवाएँ: "${m[1]}" बंद की गई (क्रम से बदलाव, कोई टकराव नहीं)।`],
  [/^Medications: "(.+)" incoming change was older than the stored value, kept (.+)\.$/, (m) => `दवाएँ: "${m[1]}" आया हुआ बदलाव सहेजे गए मान से पुराना था, ${value(m[2])} रखा गया।`],
  [/^Medications: "(.+)" concurrent edits agree on (.+), no review needed\.$/, (m) => `दवाएँ: "${m[1]}" एक साथ हुए बदलाव ${value(m[2])} पर सहमत हैं, समीक्षा की ज़रूरत नहीं।`],
  [/^Medications: "(.+)" changed locally, awaiting server check\.$/, (m) => `दवाएँ: "${m[1]}" इस डिवाइस पर बदली गई, सर्वर की जाँच बाकी है।`],
  [/^Medications: "(.+)" conflict detected \((.+) vs (.+)\), awaiting manual review\.$/, (m) => `दवाएँ: "${m[1]}" में टकराव मिला (${value(m[2])} बनाम ${value(m[3])}), समीक्षा बाकी है।`],
  [/^Medications: "(.+)" conflict resolved by a reviewer, (.+) -> (.+)\.$/, (m) => `दवाएँ: "${m[1]}" का टकराव समीक्षक ने सुलझाया, ${value(m[2])} → ${value(m[3])}।`],
  [/^Vitals: reading already recorded\.$/, () => 'वाइटल्स: रीडिंग पहले से दर्ज है।'],
  [/^Vitals: new reading from (.+) added to history \(readings are never overwritten\)\.$/, (m) => `वाइटल्स: ${m[1]} की नई रीडिंग इतिहास में जोड़ी गई (रीडिंग कभी बदली नहीं जातीं)।`],
  [/^Patient record "(.+)" already existed, creation merged field by field\.$/, (m) => `मरीज़ रिकॉर्ड "${m[1]}" पहले से था, हर फ़ील्ड अलग से मिलाया गया।`],
  [
    /^Patient record "(.+)" created with (\d+) allerg(?:y|ies), (\d+) medications? and (\d+) vital readings?\.$/,
    (m) => `मरीज़ रिकॉर्ड "${m[1]}" बनाया गया: ${m[2]} एलर्जी, ${m[3]} दवाएँ और ${m[4]} वाइटल रीडिंग।`,
  ],
  [/^Patient record archived \(soft delete, history is kept\)\.$/, () => 'मरीज़ रिकॉर्ड संग्रहित किया गया (इतिहास सुरक्षित है)।'],
  [new RegExp(`^Patient delete not applied \\(${R}\\)\\.$`), (m) => `मरीज़ रिकॉर्ड हटाना लागू नहीं हुआ (${reason(m[1])})।`],
];

export function translateReport(report: string): string {
  if (getLang() === 'en' || !report) return report;
  // A reviewer's note is appended by the server as " Note: ...".
  const noteAt = report.indexOf(' Note: ');
  const body = noteAt >= 0 ? report.slice(0, noteAt) : report;
  const note = noteAt >= 0 ? ` नोट: ${report.slice(noteAt + 7)}` : '';
  for (const [re, out] of RULES) {
    const m = re.exec(body);
    if (m) return out(m) + note;
  }
  return report;
}

/**
 * i18n.ts — English / Hindi text for the whole app, with no network needed.
 *
 * The English sentence is the key: t('Patients') returns 'मरीज़' when Hindi is on
 * and falls back to the English text when a translation is missing. Placeholders
 * in braces are filled from vars: t('{count} to review', { count: 3 }).
 *
 * The choice is stored per device (not per account) so it is already set on the
 * sign-in screen, before anyone has logged in.
 */
import { DISTRICT_FACILITY } from '@shared/types';
import { hi } from './hi';

export const LANGS = ['en', 'hi'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी' };

const KEY = 'healthsync.lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = readLang();
const listeners = new Set<() => void>();

function applyToDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'hi' ? 'hi' : 'en';
}
applyToDocument();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
  applyToDocument();
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Sentences that carry a value in the middle, e.g. errors built on the server. */
const PATTERNS: [RegExp, string][] = [
  [/^This is a (.+) account\. Choose (.+) above and sign in again\.$/, 'यह $1 खाता है। ऊपर $2 चुनें और फिर से साइन इन करें।'],
  [/^A (.+) account cannot have that role$/, '$1 खाते में यह भूमिका नहीं हो सकती'],
  [/^Request failed \((\d+)\)$/, 'अनुरोध विफल रहा ($1)'],
  [/^This device \((.+)\)$/, 'यह डिवाइस ($1)'],
  [/^Device (.+) \((.+)\)$/, 'डिवाइस $1 ($2)'],
  [/^(.+) must be a number$/, '$1 एक संख्या होनी चाहिए'],
  [/^(.+) must be between (\d+) and (\d+)$/, '$1 $2 और $3 के बीच होना चाहिए'],
];

const missing = new Set<string>();

function lookup(text: string): string {
  if (current === 'en') return text;
  const hit = hi[text];
  if (hit !== undefined) return hit;
  for (const [re, out] of PATTERNS) {
    if (re.test(text)) return text.replace(re, (...m) => out.replace(/\$(\d)/g, (_, i) => {
        const part = m[Number(i)] as string;
        return /^\d+$/.test(part) ? part : lookup(part);
      }));
  }
  if (import.meta.env.DEV && text.trim() && !missing.has(text)) {
    missing.add(text);
    console.warn(`[i18n] missing Hindi for: ${JSON.stringify(text)}`);
  }
  return text;
}

/** Translate an English sentence into the current language. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = lookup(text);
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A facility name: the district hospital is translated, PHC names are kept as registered. */
export function tFacility(name: string): string {
  return name === DISTRICT_FACILITY ? t(name) : name;
}

/** Count-aware text: tp(n, '{count} change', '{count} changes'). */
export function tp(count: number, one: string, other: string, vars?: Record<string, string | number>): string {
  return t(count === 1 ? one : other, { count, ...vars });
}

/** Locale for dates and numbers: Hindi uses hi-IN, English keeps the browser's own. */
export function dateLocale(): string | undefined {
  return current === 'hi' ? 'hi-IN' : undefined;
}

/** Every Hindi miss seen so far in this tab (development aid). */
export function missingTranslations(): string[] {
  return [...missing];
}

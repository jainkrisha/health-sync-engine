import { LANGS, LANG_NAMES } from './i18n';
import { useI18n } from './useI18n';

/**
 * English | हिन्दी, as public services show a language choice: the current
 * language in plain text, the other one as a link-style button.
 */
export function LanguageSwitch({ className = '', light = false }: { className?: string; light?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`flex items-center gap-3 ${className}`} role="group" aria-label={t('Language')}>
      {LANGS.map((l, i) => (
        <span key={l} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden="true">|</span>}
          {lang === l ? (
            <span lang={l} className="font-bold" aria-current="true">
              {LANG_NAMES[l]}
            </span>
          ) : (
            <button type="button" lang={l} onClick={() => setLang(l)} className={`underline underline-offset-[0.15em] hover:decoration-[3px] ${light ? 'text-white' : 'text-link'}`}>
              {LANG_NAMES[l]}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

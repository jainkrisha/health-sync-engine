import { LANGS, LANG_NAMES } from './i18n';
import { useI18n } from './useI18n';

/** Two-option English / हिन्दी toggle. Pass the button group's class for the surface it sits on. */
export function LanguageSwitch({ className = '', buttonClassName = '' }: { className?: string; buttonClassName?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={className} role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={buttonClassName}>
          {LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}

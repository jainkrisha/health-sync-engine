import { useSyncExternalStore } from 'react';
import './hindi.css';
import { dateLocale, getLang, setLang, subscribeLang, t, tp } from './i18n';

/**
 * Re-renders the component when the language changes. Every component that shows
 * text calls this, even when it only needs t, so a switch updates it at once.
 */
export function useI18n() {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return { lang, setLang, t, tp, locale: dateLocale() };
}

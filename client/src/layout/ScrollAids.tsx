/** Scroll helpers for long pages: a thin progress bar under the header and a back-to-top button. */
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/useI18n';

function useScroll() {
  const [state, setState] = useState({ y: 0, progress: 0 });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setState({ y: window.scrollY, progress: max > 0 ? Math.min(1, window.scrollY / max) : 0 });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return state;
}

export function ScrollProgress() {
  const { progress } = useScroll();
  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden" aria-hidden="true">
      <div
        className="h-full origin-left bg-gradient-to-r from-teal-500 to-medical-500 transition-opacity duration-300"
        style={{ transform: `scaleX(${progress})`, opacity: progress > 0.01 ? 1 : 0 }}
      />
    </div>
  );
}

export function BackToTop() {
  const { y } = useScroll();
  const { t } = useI18n();
  const visible = y > 600;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('Back to top')}
      data-tip={t('Back to top')}
      data-tip-pos="top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-24 right-4 z-header flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-card-lg
        transition-[opacity,transform,color] duration-200 hover:text-teal-700 active:scale-95 lg:bottom-8 lg:right-8
        dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-teal-300
        ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <Icon name="arrowUp" className="h-5 w-5" />
    </button>
  );
}

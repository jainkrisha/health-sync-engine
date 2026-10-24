import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/useI18n';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Icon name="search" className="h-8 w-8" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{t('Page not found')}</h1>
      <p className="mt-2 max-w-md text-base text-slate-700 dark:text-slate-300">
        {t('That page does not exist. If you followed a link to a patient, the record may have been archived or not synced to this device yet.')}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-plain" onClick={() => navigate(-1)}>
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" /> {t('Go back')}
        </button>
        <Link to="/dashboard" className="btn-primary">
          <Icon name="home" className="h-5 w-5" /> {t('Go to home page')}
        </Link>
      </div>
    </div>
  );
}

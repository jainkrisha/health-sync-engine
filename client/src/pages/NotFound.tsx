import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/useI18n';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
      <p className="bg-gradient-to-br from-teal-500 to-teal-800 bg-clip-text text-7xl font-bold tracking-tighter text-transparent sm:text-8xl">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{t('Page not found')}</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
        {t('That page does not exist. If you followed a link to a patient, the record may have been archived or not synced to this device yet.')}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" /> {t('Go back')}
        </button>
        <Link to="/dashboard" className="btn-primary">
          <Icon name="dashboard" className="h-4 w-4" /> {t('Back to dashboard')}
        </Link>
      </div>
    </div>
  );
}

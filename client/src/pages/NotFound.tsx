import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="max-w-[40rem]">
      <h1 className="heading-xl">{t('Page not found')}</h1>
      <p className="lead mt-4">
        {t('That page does not exist. If you followed a link to a patient, the record may have been archived or not synced to this device yet.')}
      </p>
      <p className="mt-6 flex flex-wrap gap-6">
        <Link to="/dashboard" className="link">
          {t('Go to home page')}
        </Link>
        <button type="button" className="link" onClick={() => navigate(-1)}>
          {t('Go back')}
        </button>
      </p>
    </div>
  );
}

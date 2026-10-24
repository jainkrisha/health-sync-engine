/**
 * Sign-in. First "Where do you work?" (a health centre, or the district
 * hospital), then the username and password for that place. The same card
 * switches to "Create an account". Each account opens only in its own place;
 * the server says so in plain words if someone picks the wrong one.
 */
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_ROLES, ROLE_LABELS, type Portal, type Role } from '@shared/types';
import { Icon, type IconName } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { deviceLabel, profileKey } from '../../lib/deviceProfile';
import { useI18n } from '../../i18n/useI18n';
import { t as translate } from '../../i18n/i18n';
import { LanguageSwitch } from '../../i18n/LanguageSwitch';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

const registerSchema = z.object({
  facility: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1, 'Enter your full name').max(80),
  username: z
    .string()
    .trim()
    .min(3, 'Use at least 3 letters or numbers')
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Use only English letters, numbers, dots, dashes or underscores'),
  password: z.string().min(6, 'Use at least 6 characters'),
  role: z.string(),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_HELP: Partial<Record<Role, string>> = {
  admin: 'Sees every health centre, staff and devices',
  clinical_reviewer: 'Checks medicine doses that two devices changed',
  auditor: 'Can read the change history; cannot edit',
};

const PLACES: Record<Portal, { title: string; help: string; icon: IconName; signIn: string; create: string }> = {
  phc: {
    title: 'Primary Health Centre (PHC)',
    help: 'For doctors, nurses and health workers. Works without internet.',
    icon: 'clinic',
    signIn: 'Sign in to PHC',
    create: 'Create PHC account',
  },
  district: {
    title: 'District hospital',
    help: 'For administrators, dose reviewers and auditors.',
    icon: 'hospital',
    signIn: 'Sign in to district system',
    create: 'Create district account',
  },
};

const PORTAL_KEY = profileKey('portal');

function readPortal(): Portal {
  try {
    return localStorage.getItem(PORTAL_KEY) === 'district' ? 'district' : 'phc';
  } catch {
    return 'phc';
  }
}

function rememberPortal(p: Portal) {
  try {
    localStorage.setItem(PORTAL_KEY, p);
  } catch {
    // ignore
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  useI18n();
  if (!message) return null;
  return (
    <p className="form-error" id={id}>
      <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" /> {translate(message)}
    </p>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {help && (
        <p className="form-help -mt-1 mb-1.5" id={`${id}-help`}>
          {help}
        </p>
      )}
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function PlaceChoice({ portal, onChange }: { portal: Portal; onChange: (p: Portal) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="form-label">{t('Where do you work?')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['phc', 'district'] as const).map((p) => {
          const place = PLACES[p];
          const checked = portal === p;
          return (
            <label
              key={p}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 ${
                checked
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-300 dark:bg-brand-950'
                  : 'border-slate-300 bg-white hover:border-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-brand-300'
              }`}
            >
              <input type="radio" name="place" value={p} checked={checked} onChange={() => onChange(p)} className="mt-1 h-5 w-5 flex-shrink-0 accent-brand-600" />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <Icon name={place.icon} className="h-5 w-5 flex-shrink-0" /> {t(place.title)}
                </span>
                <span className="mt-1 block text-sm text-slate-700 dark:text-slate-300">{t(place.help)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SignInForm({ portal, onCreate }: { portal: Portal; onCreate: () => void }) {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const errors = form.formState.errors;

  const onSubmit = async (v: LoginValues) => {
    setServerError(null);
    try {
      await login(v.username, v.password, portal);
      rememberPortal(portal);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label={t(PLACES[portal].signIn)}>
      <Field id="login-username" label={t('Username')} error={errors.username?.message}>
        <input
          id="login-username"
          className={`form-input ${errors.username ? 'form-input-error' : ''}`}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? 'login-username-error' : undefined}
          {...form.register('username')}
        />
      </Field>
      <Field id="login-password" label={t('Password')} error={errors.password?.message}>
        <div className="flex gap-2">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            className={`form-input ${errors.password ? 'form-input-error' : ''}`}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...form.register('password')}
          />
          <button type="button" className="btn-plain flex-shrink-0" onClick={() => setShowPassword((s) => !s)} aria-pressed={showPassword}>
            <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-5 w-5" />
            {showPassword ? t('Hide') : t('Show')}
          </button>
        </div>
      </Field>
      {serverError && (
        <div role="alert" className="notice-danger">
          <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{t(serverError)}</p>
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : <Icon name="arrowRight" className="h-5 w-5" />}
        {t(PLACES[portal].signIn)}
      </button>
      <p className="text-center text-base text-slate-700 dark:text-slate-300">
        {t('First time here?')}{' '}
        <button type="button" className="link" onClick={onCreate}>
          {t('Create an account')}
        </button>
      </p>
    </form>
  );
}

function RegisterForm({ portal, onBack }: { portal: Portal; onBack: () => void }) {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: PORTAL_ROLES[portal][0], facility: '' },
  });
  const errors = form.formState.errors;

  const onSubmit = async (v: RegisterValues) => {
    setServerError(null);
    if (portal === 'phc' && !v.facility?.trim()) {
      form.setError('facility', { message: 'Enter the name of your PHC' });
      return;
    }
    try {
      await register({ ...v, portal, role: v.role as Role, facility: portal === 'phc' ? v.facility : undefined });
      rememberPortal(portal);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const input = (name: 'name' | 'username' | 'password' | 'facility', props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`reg-${name}`}
      className={`form-input ${errors[name] ? 'form-input-error' : ''}`}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? `reg-${name}-error` : undefined}
      {...props}
      {...form.register(name)}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label={t(PLACES[portal].create)}>
      <Field id="reg-name" label={t('Full name')} error={errors.name?.message}>
        {input('name', { autoComplete: 'name' })}
      </Field>
      {portal === 'phc' ? (
        <Field id="reg-facility" label={t('PHC name')} help={t('For example: PHC Hadapsar')} error={errors.facility?.message}>
          {input('facility')}
        </Field>
      ) : (
        <fieldset>
          <legend className="form-label">{t('What is your job?')}</legend>
          <div className="grid gap-2">
            {PORTAL_ROLES.district.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-slate-300 p-3 hover:border-brand-600 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:border-slate-600 dark:has-[:checked]:border-brand-300 dark:has-[:checked]:bg-brand-950"
              >
                <input type="radio" value={r} className="mt-1 h-5 w-5 flex-shrink-0 accent-brand-600" {...form.register('role')} />
                <span>
                  <span className="block font-bold text-slate-900 dark:text-white">{t(ROLE_LABELS[r])}</span>
                  <span className="block text-sm text-slate-700 dark:text-slate-300">{t(ROLE_HELP[r] ?? '')}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field id="reg-username" label={t('Choose a username')} help={t('You will type this every time you sign in.')} error={errors.username?.message}>
        {input('username', { autoComplete: 'username', autoCapitalize: 'none', spellCheck: false })}
      </Field>
      <Field id="reg-password" label={t('Choose a password')} help={t('At least 6 characters.')} error={errors.password?.message}>
        {input('password', { type: 'password', autoComplete: 'new-password' })}
      </Field>
      {serverError && (
        <div role="alert" className="notice-danger">
          <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{t(serverError)}</p>
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : <Icon name="check" className="h-5 w-5" />}
        {t(PLACES[portal].create)}
      </button>
      <p className="text-center">
        <button type="button" className="link" onClick={onBack}>
          {t('I already have an account: sign in')}
        </button>
      </p>
    </form>
  );
}

export function Login() {
  const [portal, setPortal] = useState<Portal>(readPortal);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const { t } = useI18n();

  const points: [IconName, string][] = [
    ['wifiOff', 'Keeps working when the internet is off.'],
    ['sync', 'Sends records to the district hospital when you are back online.'],
    ['lock', 'Patient records are locked (encrypted) on this device.'],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-10 w-10" />
            <span className="text-xl font-bold text-slate-900 dark:text-white">HealthSync</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="globe" className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            <span className="sr-only">{t('Language')}</span>
            <LanguageSwitch className="flex gap-2" buttonClassName="segmented-item min-h-[2.5rem] px-3 py-1.5" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-start lg:py-14">
        <section className="lg:pt-6" aria-labelledby="about-h">
          <h2 id="about-h" className="text-[1.75rem] font-bold leading-tight text-slate-900 sm:text-[2.25rem] dark:text-white">
            {t('Patient records for health centres')}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-slate-700 dark:text-slate-300">
            {t('Record patients, allergies, medicines and check-ups. Everything is saved on this device first.')}
          </p>
          <ul className="mt-6 space-y-4">
            {points.map(([icon, text]) => (
              <li key={text} className="flex items-start gap-3 text-base text-slate-800 dark:text-slate-200">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  <Icon name={icon} className="h-5 w-5" />
                </span>
                <span className="pt-2">{t(text)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-6 sm:p-8" aria-labelledby="signin-h">
          <h1 id="signin-h" className="page-title">
            {mode === 'signin' ? t('Sign in') : t('Create an account')}
          </h1>
          <PlaceChoice portal={portal} onChange={setPortal} />
          {mode === 'signin' ? (
            <SignInForm key={`in-${portal}`} portal={portal} onCreate={() => setMode('register')} />
          ) : (
            <RegisterForm key={`reg-${portal}`} portal={portal} onBack={() => setMode('signin')} />
          )}
          <details className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-base dark:border-slate-700 dark:bg-slate-800/60">
            <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">{t('Demo accounts for the project')}</summary>
            <dl className="mt-3 space-y-1 text-slate-800 dark:text-slate-200">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t('PHC')}:</dt>
                <dd className="font-mono">worker1 … worker5</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t('District hospital')}:</dt>
                <dd className="font-mono">admin, reviewer, auditor</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t('Password')}:</dt>
                <dd className="font-mono">password123</dd>
              </div>
            </dl>
          </details>
        </section>
      </main>

      <footer className="px-4 pb-6 text-center text-sm text-slate-700 dark:text-slate-300">
        {t(deviceLabel)} · {t('The first sign-in needs internet. After that, the PHC works offline.')}
      </footer>
    </div>
  );
}

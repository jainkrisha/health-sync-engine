/**
 * Sign-in, laid out like a public service form: one question at the top
 * ("Where do you work?"), then the username and password for that place, one
 * green button. "Create an account" swaps the same form to registration. Each
 * account opens only in its own place; the server says so in plain words.
 */
import { useState, type ReactNode } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_ROLES, ROLE_LABELS, type Portal, type Role } from '@shared/types';
import { Spinner } from '../../components/ui';
import { Mark } from '../../components/Mark';
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

const PLACES: Record<Portal, { title: string; help: string; signIn: string; create: string }> = {
  phc: {
    title: 'Primary Health Centre (PHC)',
    help: 'For doctors, nurses and health workers. Works without internet.',
    signIn: 'Sign in to PHC',
    create: 'Create PHC account',
  },
  district: {
    title: 'District hospital',
    help: 'For administrators, dose reviewers and auditors.',
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

/** "There is a problem" box at the top of the form, each line linking to its field. */
function ErrorSummary({ errors, server, ids }: { errors: FieldErrors; server: string | null; ids: Record<string, string> }) {
  useI18n();
  const items = Object.entries(errors)
    .filter(([, e]) => e?.message)
    .map(([field, e]) => ({ id: ids[field], message: String(e!.message) }));
  if (!items.length && !server) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1}>
      <h2 className="heading-m">{translate('There is a problem')}</h2>
      <ul className="mt-3 space-y-1">
        {server && <li className="font-bold text-alert">{translate(server)}</li>}
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="font-bold text-alert underline">
              {translate(i.message)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={`form-group ${error ? 'form-group-error' : ''}`}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {hint && (
        <span className="form-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="form-error" id={`${id}-error`}>
          {translate(error)}
        </span>
      )}
      {children}
    </div>
  );
}

function PlaceChoice({ portal, onChange }: { portal: Portal; onChange: (p: Portal) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="form-group">
      <legend className="form-label-l">{t('Where do you work?')}</legend>
      <div className="radios">
        {(['phc', 'district'] as const).map((p) => (
          <label key={p} className="radio">
            <input type="radio" name="place" value={p} checked={portal === p} onChange={() => onChange(p)} aria-describedby={`place-${p}-hint`} />
            <span className="radio-label">
              <span className="block font-bold">{t(PLACES[p].title)}</span>
              <span className="block text-muted" id={`place-${p}-hint`}>
                {t(PLACES[p].help)}
              </span>
            </span>
          </label>
        ))}
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
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate aria-label={t(PLACES[portal].signIn)}>
        <ErrorSummary errors={errors} server={serverError} ids={{ username: 'login-username', password: 'login-password' }} />
        <Field id="login-username" label={t('Username')} error={errors.username?.message}>
          <input
            id="login-username"
            className={`input w-chars-20 max-w-full ${errors.username ? 'input-error' : ''}`}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={errors.username ? 'login-username-error' : undefined}
            {...form.register('username')}
          />
        </Field>
        <Field id="login-password" label={t('Password')} error={errors.password?.message}>
          <div className="flex max-w-full items-stretch gap-3">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className={`input w-chars-20 max-w-full ${errors.password ? 'input-error' : ''}`}
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...form.register('password')}
            />
            <button type="button" className="btn-secondary" onClick={() => setShowPassword((s) => !s)} aria-pressed={showPassword} aria-controls="login-password">
              {showPassword ? t('Hide') : t('Show')}
            </button>
          </div>
        </Field>
        <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t(PLACES[portal].signIn)}
        </button>
      </form>

      <h2 className="heading-m mt-12">{t('First time here?')}</h2>
      <p className="mt-2">
        {t('Ask your medical officer for an account, or')}{' '}
        <button type="button" className="link" onClick={onCreate}>
          {t('Create an account')}
        </button>
        .
      </p>
    </>
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

  const input = (name: 'name' | 'username' | 'password' | 'facility', width: string, extra: Record<string, unknown> = {}) => (
    <input
      id={`reg-${name}`}
      className={`input ${width} max-w-full ${errors[name] ? 'input-error' : ''}`}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={[`reg-${name}-hint`, errors[name] && `reg-${name}-error`].filter(Boolean).join(' ')}
      {...extra}
      {...form.register(name)}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate aria-label={t(PLACES[portal].create)}>
      <ErrorSummary
        errors={errors}
        server={serverError}
        ids={{ name: 'reg-name', facility: 'reg-facility', username: 'reg-username', password: 'reg-password' }}
      />
      <Field id="reg-name" label={t('Full name')} error={errors.name?.message}>
        {input('name', 'w-full', { autoComplete: 'name' })}
      </Field>
      {portal === 'phc' ? (
        <Field id="reg-facility" label={t('PHC name')} hint={t('For example: PHC Hadapsar')} error={errors.facility?.message}>
          {input('facility', 'w-full')}
        </Field>
      ) : (
        <fieldset className="form-group">
          <legend className="form-label">{t('What is your job?')}</legend>
          <div className="radios">
            {PORTAL_ROLES.district.map((r) => (
              <label key={r} className="radio">
                <input type="radio" value={r} {...form.register('role')} />
                <span className="radio-label">
                  <span className="block font-bold">{t(ROLE_LABELS[r])}</span>
                  <span className="block text-muted">{t(ROLE_HELP[r] ?? '')}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field id="reg-username" label={t('Choose a username')} hint={t('You will type this every time you sign in.')} error={errors.username?.message}>
        {input('username', 'w-chars-20', { autoComplete: 'username', autoCapitalize: 'none', spellCheck: false })}
      </Field>
      <Field id="reg-password" label={t('Choose a password')} hint={t('At least 6 characters.')} error={errors.password?.message}>
        {input('password', 'w-chars-20', { type: 'password', autoComplete: 'new-password' })}
      </Field>
      <div className="flex flex-wrap items-center gap-6">
        <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t(PLACES[portal].create)}
        </button>
        <button type="button" className="link" onClick={onBack}>
          {t('I already have an account: sign in')}
        </button>
      </div>
    </form>
  );
}

export function Login() {
  const [portal, setPortal] = useState<Portal>(readPortal);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-band text-white">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2.5">
            <Mark className="h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">HealthSync</span>
          </span>
          <LanguageSwitch light className="ml-auto" />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-page flex-1 gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 md:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="heading-xl">{mode === 'signin' ? t('Sign in') : t('Create an account')}</h1>
          <p className="lead mt-4">{t('Patient records for health centres. Everything is saved on this device first.')}</p>
          <div className="mt-8">
            <PlaceChoice portal={portal} onChange={setPortal} />
            {mode === 'signin' ? (
              <SignInForm key={`in-${portal}`} portal={portal} onCreate={() => setMode('register')} />
            ) : (
              <RegisterForm key={`reg-${portal}`} portal={portal} onBack={() => setMode('signin')} />
            )}
          </div>
        </div>

        <aside className="border-t-[5px] border-band pt-4 md:mt-[4.5rem]">
          <h2 className="heading-m">{t('Works without internet')}</h2>
          <p className="mt-2">{t('The first sign-in needs internet. After that, the PHC works offline.')}</p>
          <p className="mt-3">{t('Records are locked (encrypted) on this device and sent to the district hospital when you are back online.')}</p>
          <details className="details mt-6">
            <summary>{t('Demo accounts for the project')}</summary>
            <div className="details-body">
              <dl className="space-y-2">
                <div>
                  <dt className="font-bold">{t('PHC')}</dt>
                  <dd className="font-mono">worker1 … worker5</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('District hospital')}</dt>
                  <dd className="font-mono">admin, reviewer, auditor</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('Password')}</dt>
                  <dd className="font-mono">password123</dd>
                </div>
              </dl>
            </div>
          </details>
        </aside>
      </main>

      <footer className="border-t-[3px] border-band bg-panel">
        <p className="mx-auto max-w-page px-4 py-5 text-sm text-muted sm:px-6">{t(deviceLabel)}</p>
      </footer>
    </div>
  );
}

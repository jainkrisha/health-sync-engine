import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PORTALS, PORTAL_ROLES, ROLES, ROLE_LABELS, type Portal } from '@shared/types';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { deviceLabel, profileKey } from '../../lib/deviceProfile';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z
  .object({
    portal: z.enum(PORTALS),
    facility: z.string().trim().max(80).optional(),
    name: z.string().trim().min(1, 'Your name is required').max(80),
    username: z
      .string()
      .trim()
      .min(3, 'At least 3 characters')
      .max(40)
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, numbers, dots, dashes or underscores only'),
    password: z.string().min(6, 'At least 6 characters'),
    role: z.enum(ROLES),
  })
  .superRefine((v, ctx) => {
    if (v.portal === 'phc' && !v.facility) {
      ctx.addIssue({ code: 'custom', path: ['facility'], message: 'Enter the name of your PHC' });
    }
    if (!PORTAL_ROLES[v.portal].includes(v.role)) {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'Pick a role for this portal' });
    }
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_HELP: Record<(typeof ROLES)[number], string> = {
  health_worker: 'Records and edits patient data at the PHC.',
  clinical_reviewer: 'Resolves medication conflicts between PHC devices.',
  admin: "Every PHC's data, conflict review, audit trail, users and devices.",
  auditor: 'Read-only access to records and the audit trail.',
};

const PORTAL_INFO: Record<
  Portal,
  { title: string; subtitle: string; icon: 'clinic' | 'hospital' }
> = {
  phc: {
    title: 'PHC',
    subtitle: 'Local doctor at a Primary Health Centre. Works offline.',
    icon: 'clinic',
  },
  district: {
    title: 'Admin',
    subtitle: 'Central system at the district hospital. All PHCs.',
    icon: 'hospital',
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

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [portal, setPortal] = useState<Portal>(readPortal);
  const [serverError, setServerError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { portal: readPortal(), role: PORTAL_ROLES[readPortal()][0], facility: '' },
  });

  const choosePortal = (next: Portal) => {
    setPortal(next);
    setServerError(null);
    registerForm.setValue('portal', next);
    registerForm.setValue('role', PORTAL_ROLES[next][0]);
    registerForm.clearErrors();
    try {
      localStorage.setItem(PORTAL_KEY, next);
    } catch {
      // ignore
    }
  };

  const onLogin = async (values: LoginValues) => {
    setServerError(null);
    try {
      await login(values.username, values.password, portal);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setServerError(null);
    try {
      await register(values);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setServerError(null);
  };

  const [showPassword, setShowPassword] = useState(false);

  const submitting =
    mode === 'login' ? loginForm.formState.isSubmitting : registerForm.formState.isSubmitting;

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] dark:bg-slate-950">
      {/* Brand panel: same dark slate as the app sidebar, with the teal accent. */}
      <aside className="relative hidden overflow-hidden bg-slate-900 p-12 text-slate-300 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-medical-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl shadow-teal-glow" />
          <span className="text-xl font-bold tracking-tight text-white">HealthSync</span>
        </div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">Patient records that keep working when the network does not.</h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Every PHC device keeps an encrypted copy. When devices reconnect, edits merge field by field, and nothing clinical is guessed.
          </p>
          <ul className="mt-10 space-y-5">
            {[
              { icon: 'wifiOff' as const, title: 'Works offline', text: 'Add, edit and review patients with no connection.' },
              { icon: 'merge' as const, title: 'Safe merging', text: 'Allergies are never lost; conflicting doses go to a reviewer.' },
              { icon: 'shield' as const, title: 'Full audit trail', text: 'Every merge decision is recorded and cannot be edited.' },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-teal-300 ring-1 ring-inset ring-white/10">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{f.title}</span>
                  <span className="block text-sm text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Group 17 mini project · Offline-first, conflict-resolving health records</p>
      </aside>

      <div className="relative flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-teal-50/70 px-4 py-10 sm:px-8 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/30">
      <button
        onClick={toggleTheme}
        className="btn-icon absolute right-4 top-4"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        data-tip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        data-tip-pos="left"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
      </button>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center lg:text-left">
          <img src="/favicon.svg" alt="" className="mx-auto mb-4 h-14 w-14 rounded-2xl shadow-teal-glow lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {mode === 'login' ? 'Sign in to HealthSync' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? 'Choose where you work, then sign in.' : 'Offline-first patient records for field health teams.'}
          </p>
        </div>

        <fieldset className="mb-4">
          <legend className="sr-only">Sign in as</legend>
          <div className="grid grid-cols-2 gap-3">
            {PORTALS.map((p) => (
              <label
                key={p}
                className="relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-slate-200 bg-white p-3.5 text-sm shadow-sm transition-[border-color,background-color,box-shadow] duration-150 hover:border-slate-300 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 has-[:focus-visible]:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:has-[:checked]:border-teal-500 dark:has-[:checked]:bg-teal-950/40"
              >
                <input
                  type="radio"
                  name="portal"
                  value={p}
                  checked={portal === p}
                  onChange={() => choosePortal(p)}
                  className="sr-only"
                  aria-label={`${PORTAL_INFO[p].title}: ${PORTAL_INFO[p].subtitle}`}
                />
                {portal === p && (
                  <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white animate-scale-in" aria-hidden="true">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                )}
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <Icon
                    name={PORTAL_INFO[p].icon}
                    className="h-5 w-5 text-teal-600 dark:text-teal-400"
                  />
                  {PORTAL_INFO[p].title}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {PORTAL_INFO[p].subtitle}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="card overflow-hidden p-0 shadow-card-lg sm:p-0">
          <div
            className="grid grid-cols-2 border-b border-slate-100 text-sm font-semibold dark:border-slate-800"
            role="tablist"
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`py-3.5 transition-[color,box-shadow,background-color] duration-150 ${
                  mode === m
                    ? 'text-teal-700 shadow-[inset_0_-2px_0] shadow-teal-600 dark:text-teal-300'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {serverError && (
              <div
                role="alert"
                className="mb-5 flex animate-fade-in items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="login-username" className="form-label">
                    Username
                  </label>
                  <input
                    id="login-username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={`form-input ${loginForm.formState.errors.username ? 'form-input-error' : ''}`}
                    {...loginForm.register('username')}
                  />
                  {loginForm.formState.errors.username && (
                    <p className="form-error">{loginForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="login-password" className="form-label">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className={`form-input pr-11 ${loginForm.formState.errors.password ? 'form-input-error' : ''}`}
                      {...loginForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="btn-icon absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                      aria-label={showPassword ? 'Hide characters' : 'Show characters'}
                      aria-pressed={showPassword}
                    >
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="form-error">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                  {submitting && <Spinner />}
                  {portal === 'phc' ? 'Sign in to PHC' : 'Sign in to district system'}
                </button>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/60">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Demo accounts</span> (password <code className="font-mono">password123</code>):{' '}
                  {portal === 'phc' ? (
                    <><code className="font-mono">worker1</code>, <code className="font-mono">worker2</code></>
                  ) : (
                    <><code className="font-mono">admin</code>, <code className="font-mono">reviewer</code>, <code className="font-mono">auditor</code></>
                  )}
                </div>
              </form>
            ) : (
              <form
                onSubmit={registerForm.handleSubmit(onRegister)}
                className="space-y-4"
                noValidate
              >
                <div>
                  <label htmlFor="reg-name" className="form-label">
                    Full name
                  </label>
                  <input
                    id="reg-name"
                    autoComplete="name"
                    className="form-input"
                    {...registerForm.register('name')}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="form-error">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="reg-username" className="form-label">
                    Username
                  </label>
                  <input
                    id="reg-username"
                    autoComplete="username"
                    className="form-input"
                    {...registerForm.register('username')}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="form-error">{registerForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="reg-password" className="form-label">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    className="form-input"
                    {...registerForm.register('password')}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="form-error">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
                {portal === 'phc' ? (
                  <div>
                    <label htmlFor="reg-facility" className="form-label">
                      PHC name
                    </label>
                    <input
                      id="reg-facility"
                      placeholder="e.g. PHC Wagholi"
                      className="form-input"
                      {...registerForm.register('facility')}
                    />
                    {registerForm.formState.errors.facility && (
                      <p className="form-error">{registerForm.formState.errors.facility.message}</p>
                    )}
                  </div>
                ) : (
                  <fieldset>
                    <legend className="form-label">Role at the district hospital</legend>
                    <div className="grid gap-2">
                      {PORTAL_ROLES.district.map((r) => (
                        <label
                          key={r}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:border-slate-300 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:bg-teal-950/40"
                        >
                          <input
                            type="radio"
                            value={r}
                            className="mt-0.5 accent-teal-600"
                            {...registerForm.register('role')}
                          />
                          <span>
                            <span className="block font-semibold text-slate-800 dark:text-slate-100">
                              {ROLE_LABELS[r]}
                            </span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {ROLE_HELP[r]}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                  {submitting && <Spinner />}
                  {portal === 'phc' ? 'Create PHC account' : 'Create district account'}
                </button>
              </form>
            )}
          </div>
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-slate-400 lg:text-left">
          {deviceLabel}.{' '}
          {portal === 'phc'
            ? 'The first sign-in needs a connection; after that the PHC works offline and syncs when the network is back.'
            : 'The district system shows live data from every PHC as it syncs.'}
        </p>
      </div>
      </div>
    </div>
  );
}

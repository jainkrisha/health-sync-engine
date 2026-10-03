import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLES, ROLE_LABELS } from '@shared/types';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { deviceLabel } from '../../lib/deviceProfile';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Your name is required').max(80),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, numbers, dots, dashes or underscores only'),
  password: z.string().min(6, 'At least 6 characters'),
  role: z.enum(ROLES),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_HELP: Record<(typeof ROLES)[number], string> = {
  health_worker: 'Records and edits patient data in the field.',
  clinical_reviewer: 'Resolves medication conflicts between devices.',
  admin: 'Everything, plus user and device management.',
  auditor: 'Read-only access to records and the audit trail.',
};

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [serverError, setServerError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'health_worker' },
  });

  const onLogin = async (values: LoginValues) => {
    setServerError(null);
    try {
      await login(values.username, values.password);
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

  const submitting = mode === 'login' ? loginForm.formState.isSubmitting : registerForm.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <button
        onClick={toggleTheme}
        className="btn-ghost fixed right-4 top-4"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
      </button>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">HealthSync</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Offline-first patient records for field health teams</p>
        </div>

        <div className="card border-t-4 border-t-teal-600 p-0">
          <div className="grid grid-cols-2 border-b border-slate-100 text-sm font-semibold dark:border-slate-800" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`py-3 transition-colors ${
                  mode === m
                    ? 'text-teal-700 shadow-[inset_0_-2px_0] shadow-teal-600 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {serverError && (
              <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {serverError}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="login-username" className="form-label">Username</label>
                  <input id="login-username" autoComplete="username" className="form-input" {...loginForm.register('username')} />
                  {loginForm.formState.errors.username && <p className="form-error">{loginForm.formState.errors.username.message}</p>}
                </div>
                <div>
                  <label htmlFor="login-password" className="form-label">Password</label>
                  <input id="login-password" type="password" autoComplete="current-password" className="form-input" {...loginForm.register('password')} />
                  {loginForm.formState.errors.password && <p className="form-error">{loginForm.formState.errors.password.message}</p>}
                </div>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                  {submitting && <Spinner />}
                  Sign in
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Demo accounts (after <code className="font-mono">npm run seed</code>): admin, worker1, worker2, reviewer, auditor. Password: password123
                </p>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reg-name" className="form-label">Full name</label>
                  <input id="reg-name" autoComplete="name" className="form-input" {...registerForm.register('name')} />
                  {registerForm.formState.errors.name && <p className="form-error">{registerForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="reg-username" className="form-label">Username</label>
                  <input id="reg-username" autoComplete="username" className="form-input" {...registerForm.register('username')} />
                  {registerForm.formState.errors.username && <p className="form-error">{registerForm.formState.errors.username.message}</p>}
                </div>
                <div>
                  <label htmlFor="reg-password" className="form-label">Password</label>
                  <input id="reg-password" type="password" autoComplete="new-password" className="form-input" {...registerForm.register('password')} />
                  {registerForm.formState.errors.password && <p className="form-error">{registerForm.formState.errors.password.message}</p>}
                </div>
                <fieldset>
                  <legend className="form-label">Role</legend>
                  <div className="grid gap-2">
                    {ROLES.map((r) => (
                      <label
                        key={r}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 dark:border-slate-700 dark:has-[:checked]:bg-teal-950/40"
                      >
                        <input type="radio" value={r} className="mt-0.5 accent-teal-600" {...registerForm.register('role')} />
                        <span>
                          <span className="block font-semibold text-slate-800 dark:text-slate-100">{ROLE_LABELS[r]}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{ROLE_HELP[r]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                  {submitting && <Spinner />}
                  Create account
                </button>
              </form>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          {deviceLabel}. The first sign-in needs a connection; after that the app works offline.
        </p>
      </div>
    </div>
  );
}

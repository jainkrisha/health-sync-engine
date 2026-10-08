/**
 * Sign-in: two ID passes hang from lanyards over a liquid-metal background —
 * one for PHC doctors, one for the district hospital's central system. Each pass
 * is its own form: type your ID and password straight onto the card, or flip it
 * over to create an account.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_ROLES, ROLE_LABELS, type Portal, type Role } from '@shared/types';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { deviceLabel, profileKey } from '../../lib/deviceProfile';
import { LiquidMetal } from './LiquidMetal';
import { ParticleTitle } from './ParticleTitle';
import { PhcIntro, shouldPlayIntro } from './PhcIntro';
import { useI18n } from '../../i18n/useI18n';
import { t as translate } from '../../i18n/i18n';
import { LanguageSwitch } from '../../i18n/LanguageSwitch';
import './login.css';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your ID'),
  password: z.string().min(1, 'Enter your password'),
});

const registerSchema = z.object({
  facility: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, numbers, dots, dashes or underscores'),
  password: z.string().min(6, 'At least 6 characters'),
  role: z.string(),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_HELP: Partial<Record<Role, string>> = {
  admin: 'Every PHC, users and devices',
  clinical_reviewer: 'Resolves dose conflicts',
  auditor: 'Read-only audit access',
};

const PASS = {
  phc: {
    title: 'PHC',
    org: 'Primary Health Centre',
    chip: 'HEALTH WORKER',
    meta: [
      ['MODE', 'OFFLINE-FIRST'],
      ['STORE', 'AES-256'],
    ],
    serial: '4127-0806-PHC',
    signIn: 'Sign in to PHC',
    create: 'Create PHC account',
    footer: 'Works with no network. Syncs when back online.',
    strapText: 'HEALTHSYNC · PHC · HEALTHSYNC · PHC · HEALTHSYNC',
  },
  district: {
    title: 'ADMIN',
    org: 'District Hospital · Central',
    chip: 'DISTRICT SYSTEM',
    meta: [
      ['SCOPE', 'ALL PHCS'],
      ['VIEW', 'LIVE'],
    ],
    serial: '0921-4410-DST',
    signIn: 'Sign in to district system',
    create: 'Create district account',
    footer: 'Conflict review, audit trail, users and devices.',
    strapText: 'HEALTHSYNC · DISTRICT · HEALTHSYNC · DISTRICT',
  },
} as const;

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

function FieldError({ message }: { message?: string }) {
  useI18n();
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#b4232b]" role="alert">
      <Icon name="alert" className="h-3 w-3" /> {translate(message)}
    </p>
  );
}

function Stripes() {
  return (
    <span className="flex h-3.5 items-stretch gap-[2px]" aria-hidden="true">
      {['#e0663a', '#f0a63a', '#e9c46a', '#5f8f7a', '#4f6378', '#2d3a48'].map((c) => (
        <span key={c} className="w-[3px] rounded-[1px]" style={{ background: c }} />
      ))}
    </span>
  );
}

function IdPass({ portal, delay, from }: { portal: Portal; delay: number; from: 'left' | 'right' }) {
  const info = PASS[portal];
  const { t } = useI18n();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: PORTAL_ROLES[portal][0], facility: '' },
  });

  const onLogin = async (v: LoginValues) => {
    setServerError(null);
    try {
      await login(v.username, v.password, portal);
      rememberPortal(portal);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('Sign-in failed'));
    }
  };

  const onRegister = async (v: RegisterValues) => {
    setServerError(null);
    if (portal === 'phc' && !v.facility?.trim()) {
      registerForm.setError('facility', { message: 'Enter the name of your PHC' });
      return;
    }
    try {
      await register({ ...v, portal, role: v.role as Role, facility: portal === 'phc' ? v.facility : undefined });
      rememberPortal(portal);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('Registration failed'));
    }
  };

  const flip = (to: 'front' | 'back') => {
    setSide(to);
    setServerError(null);
  };

  // Faces are stacked absolutely for the flip; the card takes the height of the side showing.
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = side === 'front' ? frontRef.current : backRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side]);

  const lErr = loginForm.formState.errors;
  const rErr = registerForm.formState.errors;
  const id = `pass-${portal}`;

  const header = (
    <div className="flex items-center justify-between gap-2 bg-[var(--navy)] px-3 py-2 text-[var(--cream)]">
      <span className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-4 w-4 rounded-[4px]" />
        <span className="pass-mono text-[10px] font-semibold tracking-[2px]">HEALTHSYNC</span>
      </span>
      <Stripes />
    </div>
  );

  const errorBox = serverError && (
    <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-[#e9b4a4] bg-[#f6ddd3] px-2.5 py-2 text-[12px] font-medium leading-snug text-[#8a2a1a]">
      <Icon name="alert" className="mt-px h-3.5 w-3.5 flex-shrink-0" />
      <span>{t(serverError)}</span>
    </div>
  );

  return (
    <section className={`pass-col pass-${portal}`} aria-label={portal === 'district' ? t('Admin sign-in pass') : t('PHC sign-in pass')}>
      <div className={`pass-hanger ${from === 'right' ? 'from-right' : ''}`} style={{ ['--delay' as string]: `${delay}s` }}>
        <div className="pass-sway" style={{ ['--delay' as string]: `${delay}s` }}>
          <div className="pass-strap">
            <span className="pass-strap-text">{t(info.strapText)}</span>
          </div>
          <div className="pass-clip" />
          <div className="pass-sleeve">
            <span className="pass-rivet" style={{ left: 9, top: 9 }} />
            <span className="pass-rivet" style={{ right: 9, top: 9 }} />
            <span className="pass-rivet" style={{ left: 9, bottom: 9 }} />
            <span className="pass-rivet" style={{ right: 9, bottom: 9 }} />

            <div className="pass-flip">
              <div className={`pass-inner ${side === 'back' ? 'is-flipped' : ''}`} style={{ height }}>
                {/* ── Front: sign in ─────────────────────────────────────── */}
                <div className="pass-face front" ref={frontRef} aria-hidden={side !== 'front'}>
                  <div className="pass-card">
                    {header}
                    <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="px-4 pb-3 pt-3" aria-label={t(info.signIn)}>
                      <p className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[2.4px] text-[var(--orange-2)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" aria-hidden="true" />
                        {t('LOGIN AS')}
                      </p>
                      <p className="mt-0.5 text-[42px] font-extrabold leading-[0.95] tracking-[-1.5px] text-[var(--ink)]" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                        {t(info.title)}
                      </p>
                      <div className="mt-2.5 flex items-end gap-3">
                        <span className="pass-chip">{t(info.chip)}</span>
                        {info.meta.map(([k, v]) => (
                          <span key={k}>
                            <span className="pass-label">{t(k)}</span>
                            <span className="pass-mono block text-[10.5px] font-bold tracking-[1px] text-[var(--ink)]">{t(v)}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-4">
                        <label htmlFor={`${id}-user`} className="pass-label">
                          {t('Username')}
                        </label>
                        <input
                          id={`${id}-user`}
                          className="pass-field"
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="your-id"
                          aria-invalid={lErr.username ? true : undefined}
                          disabled={side !== 'front'}
                          {...loginForm.register('username')}
                        />
                        <FieldError message={lErr.username?.message} />
                      </div>

                      <div className="mt-3">
                        <label htmlFor={`${id}-pass`} className="pass-label mb-1">
                          {t('Password')}
                        </label>
                        <div className="pass-lcd" data-invalid={lErr.password ? 'true' : undefined}>
                          <input
                            id={`${id}-pass`}
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            aria-invalid={lErr.password ? true : undefined}
                            disabled={side !== 'front'}
                            {...loginForm.register('password')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="mr-1 flex h-8 w-8 items-center justify-center rounded text-[#f0a063]/70 transition-colors hover:text-[#f0a063] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0663a]"
                            aria-label={showPassword ? t('Hide characters') : t('Show characters')}
                            aria-pressed={showPassword}
                            tabIndex={side === 'front' ? 0 : -1}
                          >
                            <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                          </button>
                          <span className="mr-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#e0663a] shadow-[0_0_6px_rgba(224,102,58,0.9)]" aria-hidden="true" />
                        </div>
                        <FieldError message={lErr.password?.message} />
                      </div>

                      {errorBox}

                      <button type="submit" className="pass-btn mt-4" disabled={loginForm.formState.isSubmitting || side !== 'front'}>
                        {loginForm.formState.isSubmitting && <Spinner className="h-4 w-4" />}
                        {t(info.signIn)}
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button type="button" className="pass-link" onClick={() => flip('back')} tabIndex={side === 'front' ? 0 : -1}>
                          {t('Create account')}
                        </button>
                        <span className="pass-mono text-[9.5px] text-[rgba(29,39,51,0.55)]">
                          {t('DEMO PW')} <b className="text-[var(--ink)]">password123</b>
                        </span>
                      </div>
                    </form>

                    <div className="flex items-end justify-between gap-3 border-t border-dashed border-[rgba(29,39,51,0.2)] px-4 pb-3 pt-2.5">
                      <div className="w-[46%]">
                        <div className="pass-barcode" aria-hidden="true" />
                        <p className="pass-mono mt-1 text-[8px] tracking-[1px] text-[rgba(29,39,51,0.6)]">{info.serial}</p>
                      </div>
                      <p className="pass-mono max-w-[48%] text-right text-[8px] font-semibold leading-[1.45] tracking-[0.6px] text-[rgba(29,39,51,0.6)]">
                        {t('DEMO IDS')}: {portal === 'phc' ? 'WORKER1 · WORKER2' : 'ADMIN · REVIEWER · AUDITOR'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Back: create account ───────────────────────────────── */}
                <div className="pass-face back" ref={backRef} aria-hidden={side !== 'back'}>
                  <div className="pass-card">
                    {header}
                    <form onSubmit={registerForm.handleSubmit(onRegister)} noValidate className="space-y-3 px-4 pb-4 pt-3" aria-label={t(info.create)}>
                      <div>
                        <p className="pass-mono text-[8.5px] font-semibold tracking-[1.6px] text-[rgba(29,39,51,0.55)]">{t('NEW PASS')} · {t(info.org).toUpperCase()}</p>
                        <p className="mt-1 text-[26px] font-extrabold leading-none tracking-[-0.8px] text-[var(--ink)]">{t('Create account')}</p>
                      </div>
                      {(
                        [
                          ['name', 'Full name', 'text', 'name', 'Dr. Asha Rao'],
                          ['username', 'Username', 'text', 'username', 'asha.rao'],
                          ['password', 'Password', 'password', 'new-password', '6+ characters'],
                        ] as const
                      ).map(([field, label, type, ac, ph]) => (
                        <div key={field}>
                          <label htmlFor={`${id}-r-${field}`} className="pass-label">
                            {t(label)}
                          </label>
                          <input
                            id={`${id}-r-${field}`}
                            type={type}
                            className="pass-field"
                            autoComplete={ac}
                            placeholder={t(ph)}
                            aria-invalid={rErr[field] ? true : undefined}
                            disabled={side !== 'back'}
                            {...registerForm.register(field)}
                          />
                          <FieldError message={rErr[field]?.message} />
                        </div>
                      ))}
                      {portal === 'phc' ? (
                        <div>
                          <label htmlFor={`${id}-r-facility`} className="pass-label">
                            {t('PHC name')}
                          </label>
                          <input
                            id={`${id}-r-facility`}
                            className="pass-field"
                            placeholder="PHC Hadapsar"
                            aria-invalid={rErr.facility ? true : undefined}
                            disabled={side !== 'back'}
                            {...registerForm.register('facility')}
                          />
                          <FieldError message={rErr.facility?.message} />
                        </div>
                      ) : (
                        <fieldset>
                          <legend className="pass-label mb-1.5">{t('Role')}</legend>
                          <div className="grid gap-1.5">
                            {PORTAL_ROLES.district.map((r) => (
                              <label
                                key={r}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-[rgba(29,39,51,0.18)] px-2.5 py-1.5 text-[12px] transition-colors hover:border-[rgba(29,39,51,0.35)] has-[:checked]:border-[#e0663a] has-[:checked]:bg-[rgba(224,102,58,0.08)]"
                              >
                                <input type="radio" value={r} className="accent-[#e0663a]" disabled={side !== 'back'} {...registerForm.register('role')} />
                                <span className="font-semibold text-[var(--ink)]">{t(ROLE_LABELS[r])}</span>
                                <span className="ml-auto text-[10.5px] text-[rgba(29,39,51,0.55)]">{t(ROLE_HELP[r] ?? '')}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      {errorBox}
                      <button type="submit" className="pass-btn" disabled={registerForm.formState.isSubmitting || side !== 'back'}>
                        {registerForm.formState.isSubmitting && <Spinner className="h-4 w-4" />}
                        {t(info.create)}
                      </button>
                      <button type="button" className="pass-link block" onClick={() => flip('front')} tabIndex={side === 'back' ? 0 : -1}>
                        ← {t('Back to sign in')}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Login() {
  const [portal, setPortal] = useState<Portal>(readPortal);
  const [introDone, setIntroDone] = useState(() => !shouldPlayIntro());
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const { t } = useI18n();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    <div className="login-page relative min-h-screen overflow-x-hidden">
      <LiquidMetal />
      <LanguageSwitch className="pass-switch fixed right-3 top-3 z-50 sm:right-5 sm:top-5" />
      {!introDone && <PhcIntro onDone={() => setIntroDone(true)} />}

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Title and tagline float above the straps, which run up to the top edge. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-4 pt-6 sm:pt-8">
          <ParticleTitle className="pointer-events-auto h-[72px] w-full max-w-[720px] sm:h-[110px]" />
          <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-[3px] text-[rgba(236,231,218,0.55)] sm:mt-2">
            {t('Offline-first patient records · choose your pass')}
          </p>
        </div>

        {!introDone ? null : wide ? (
          <div className="pass-pair relative mx-auto grid w-full max-w-[1040px] grid-cols-2 gap-x-28 px-6 pb-16" style={{ ['--strap-len' as string]: '172px' }}>
            <IdPass portal="phc" delay={0.15} from="left" />
            <IdPass portal="district" delay={0.45} from="right" />
          </div>
        ) : (
          <div className="relative mx-auto flex w-full flex-col items-center px-4 pb-10" style={{ ['--strap-len' as string]: '196px' }}>
            <div className="pass-switch absolute top-[140px] z-20" role="group" aria-label={t('Choose a pass')}>
              {(['phc', 'district'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={portal === p} onClick={() => setPortal(p)}>
                  {p === 'phc' ? t('PHC') : t('Admin')}
                </button>
              ))}
            </div>
            <IdPass key={portal} portal={portal} delay={0.1} from={portal === 'phc' ? 'left' : 'right'} />
          </div>
        )}

        <p className="relative mt-auto pb-5 text-center text-[11px] text-[rgba(236,231,218,0.45)]">
          {t(deviceLabel)} · {t('The first sign-in needs a connection; after that the PHC works offline.')}
        </p>
      </div>
    </div>
  );
}

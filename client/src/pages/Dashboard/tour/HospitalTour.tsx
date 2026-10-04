/**
 * HospitalTour — scroll-driven walk through a 3D district hospital on the admin
 * dashboard: reception → ward → operating theatre → CT scan. Each room carries
 * the live numbers it stands for. three.js is loaded only here (admin only).
 */
import { useEffect, useRef, useState } from 'react';
import type { StatsResponse } from '@shared/types';
import { Icon, type IconName } from '../../../components/Icon';
import type { TourScene } from './hospitalScene';

interface Room {
  key: string;
  name: string;
  icon: IconName;
  at: number; // progress where the room is centred
  lines: (s: StatsResponse | null) => { value: string; label: string }[];
  text: string;
}

const ROOMS: Room[] = [
  {
    key: 'reception',
    name: 'Reception',
    icon: 'patients',
    at: 0.08,
    text: 'Every patient registered at any PHC arrives here, encrypted on the device first.',
    lines: (s) => [
      { value: s ? String(s.patients) : '—', label: 'patients on the server' },
      { value: s ? String(s.devices) : '—', label: 'PHC devices registered' },
    ],
  },
  {
    key: 'ward',
    name: 'General ward',
    icon: 'heart',
    at: 0.38,
    text: 'Allergies and vitals from every device merge automatically. Nothing is lost.',
    lines: (s) => [
      { value: s ? String(s.resolutions.automatic) : '—', label: 'edits merged automatically' },
      { value: s ? String(s.conflicts.pending) : '—', label: 'doses waiting for a reviewer' },
    ],
  },
  {
    key: 'ot',
    name: 'Operating theatre',
    icon: 'alert',
    at: 0.64,
    text: 'Conflicting medication doses are never guessed. A clinician decides.',
    lines: (s) => [
      { value: s ? String(s.conflicts.pending) : '—', label: 'cases awaiting review' },
      { value: s ? String(s.conflicts.resolved) : '—', label: 'cases resolved' },
    ],
  },
  {
    key: 'ct',
    name: 'CT scan',
    icon: 'device',
    at: 0.92,
    text: 'Every device is scanned into the audit trail as it syncs.',
    lines: (s) => {
      const total = s ? s.resolutions.automatic + s.resolutions.manual + s.conflicts.pending : 0;
      return [
        { value: s ? String(s.devices) : '—', label: 'devices syncing' },
        { value: s && total ? `${Math.round((s.resolutions.automatic / total) * 100)}%` : '—', label: 'resolved without a human' },
      ];
    },
  },
];

export default function HospitalTour({ stats }: { stats: StatsResponse | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TourScene | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  // Build the 3D scene (three.js is its own chunk, fetched on first use).
  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    import('./hospitalScene')
      .then(({ createHospitalScene }) => {
        if (disposed) return;
        try {
          const s = createHospitalScene(canvas);
          sceneRef.current = s;
          const r = canvas.getBoundingClientRect();
          s.resize(r.width, r.height);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Scroll → progress; pause rendering when the section is off screen.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const r = wrap.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      setProgress(p);
      sceneRef.current?.setProgress(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const onResize = () => {
      const r = canvas.getBoundingClientRect();
      sceneRef.current?.resize(r.width, r.height);
      onScroll();
    };
    const io = new IntersectionObserver(([e]) => sceneRef.current?.setActive(e.isIntersecting), { threshold: 0 });
    io.observe(wrap);
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const jumpTo = (p: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * (wrap.offsetHeight - window.innerHeight), behavior: 'smooth' });
  };
  const skip = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    window.scrollTo({ top: wrap.getBoundingClientRect().top + window.scrollY + wrap.offsetHeight - 64, behavior: 'smooth' });
  };

  // Which room's caption is showing.
  const current = ROOMS.reduce((best, r) => (Math.abs(r.at - progress) < Math.abs(best.at - progress) ? r : best), ROOMS[0]);
  const near = Math.abs(current.at - progress) < 0.13;

  if (failed) return null;

  return (
    <section ref={wrapRef} aria-label="Hospital tour" className="relative -mx-4 mb-8 h-[420vh] sm:-mx-6 lg:-mx-8">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 dark:bg-slate-900">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {/* top label */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-900/40 to-transparent p-4 sm:p-6">
          <div className="pointer-events-auto">
            <p className="eyebrow text-white/80">District network tour</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-white drop-shadow sm:text-xl">Scroll to walk through the hospital</p>
          </div>
          <button type="button" onClick={skip} className="btn pointer-events-auto bg-white/90 text-slate-800 shadow-card hover:bg-white">
            Skip tour <Icon name="chevronDown" className="h-4 w-4" />
          </button>
        </div>

        {/* room caption */}
        <div
          className={`absolute bottom-6 left-4 right-4 max-w-sm rounded-2xl border border-white/60 bg-white/85 p-5 shadow-pop backdrop-blur-md transition-all duration-500 sm:bottom-8 sm:left-8 dark:border-slate-700 dark:bg-slate-900/85 ${
            near ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          }`}
          aria-live="polite"
        >
          <p className="section-title flex items-center gap-2">
            <Icon name={current.icon} className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Room {ROOMS.indexOf(current) + 1} of {ROOMS.length}
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">{current.name}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.text}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {current.lines(stats).map((l) => (
              <div key={l.label} className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60">
                <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{l.value}</dd>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{l.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* room rail */}
        <nav aria-label="Rooms" className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3 sm:right-6">
          {ROOMS.map((r) => {
            const on = r === current && near;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => jumpTo(r.at)}
                className="group flex items-center justify-end gap-2"
                aria-label={`Go to ${r.name}`}
                aria-current={on ? 'step' : undefined}
              >
                <span className={`hidden rounded-md bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white transition-opacity sm:block ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {r.name}
                </span>
                <span className={`block rounded-full transition-all ${on ? 'h-3.5 w-3.5 bg-teal-500 ring-4 ring-teal-500/30' : 'h-2.5 w-2.5 bg-white/80 ring-1 ring-slate-400'}`} />
              </button>
            );
          })}
        </nav>

        {/* progress */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/10">
          <div className="h-full origin-left bg-teal-500" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </section>
  );
}

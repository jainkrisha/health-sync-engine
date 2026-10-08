/**
 * DistrictLanding — the admin dashboard's opening, after the "Kage" landing
 * page: an editorial, chapter-by-chapter scroll over real hospital photographs
 * (Unsplash licence), carrying the district's live analytics. The photograph
 * behind the page changes with each chapter and drifts slowly as you scroll.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PhcSummary, StatsResponse } from '@shared/types';
import { useApi } from '../../../hooks/useApi';
import { useSyncEngine } from '../../../hooks/useSync';
import './districtLanding.css';

const SCENES = [
  { src: '/landing/exterior.webp', pos: 'center 40%' },
  { src: '/landing/corridor.webp', pos: 'center 55%' },
  { src: '/landing/ward.webp', pos: 'center 50%' },
  { src: '/landing/theatre.webp', pos: 'center 35%' },
  { src: '/landing/surgeons.webp', pos: 'center 40%' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

function Arrow() {
  return (
    <svg viewBox="0 0 14 14" fill="none" width="13" height="13" aria-hidden="true">
      <path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Splits a line into masked words that rise in one after another. */
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className="dl-words">
      {text.split(' ').map((w, i) => (
        <span key={i} className="dl-word-mask">
          <span className="dl-word" style={{ ['--wd' as string]: `${delay + i * 55}ms` }}>
            {w}&nbsp;
          </span>
        </span>
      ))}
    </span>
  );
}

export default function DistrictLanding({ stats }: { stats: StatsResponse | null }) {
  const { connected } = useSyncEngine();
  const phcsApi = useApi<{ phcs: PhcSummary[] }>(connected ? '/phcs' : null, connected);
  const phcs = useMemo(() => phcsApi.data?.phcs ?? [], [phcsApi.data]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [drift, setDrift] = useState(0);

  const numbers = useMemo(() => {
    const s = stats;
    const weekSynced = s ? s.mutationsByDay.reduce((n, d) => n + d.synced, 0) : 0;
    const weekReview = s ? s.mutationsByDay.reduce((n, d) => n + d.conflicts, 0) : 0;
    const total = s ? s.resolutions.automatic + s.resolutions.manual + s.conflicts.pending : 0;
    const online = phcs.reduce((n, p) => n + p.devices.filter((d) => d.online).length, 0);
    return {
      patients: s?.patients ?? 0,
      phcs: phcs.length,
      staff: phcs.reduce((n, p) => n + p.staff.length, 0),
      devices: s?.devices ?? 0,
      online,
      weekSynced,
      weekReview,
      auto: s?.resolutions.automatic ?? 0,
      manual: s?.resolutions.manual ?? 0,
      pending: s?.conflicts.pending ?? 0,
      resolved: s?.conflicts.resolved ?? 0,
      rate: total ? Math.round(((s?.resolutions.automatic ?? 0) / total) * 100) : 0,
      byDay: s?.mutationsByDay ?? [],
      busiest: [...phcs].sort((a, b) => b.patientCount - a.patientCount)[0],
    };
  }, [stats, phcs]);

  // Reveal on scroll, track which chapter holds the screen, and drift the photo.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('rv-in')),
      { rootMargin: '0px 0px -4% 0px', threshold: 0.05 },
    );
    root.querySelectorAll('[data-rv]').forEach((el) => reveal.observe(el));
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const mid = window.innerHeight * 0.5;
        let active = 0;
        sections.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          if (r.top <= mid) active = i;
        });
        setChapter(active);
        const r = root.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setDrift(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      reveal.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const goTo = (id: string) => rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const skip = () => {
    const root = rootRef.current;
    if (root) window.scrollTo({ top: root.getBoundingClientRect().bottom + window.scrollY - 64, behavior: 'smooth' });
  };

  const chips = [
    { id: 'dl-patients', n: '01', title: 'Patients', text: `${numbers.patients} registered across ${numbers.phcs} PHCs.` },
    { id: 'dl-merges', n: '02', title: 'Merges', text: `${numbers.auto} edits merged without anyone stepping in.` },
    { id: 'dl-reviews', n: '03', title: 'Reviews', text: `${numbers.pending} doses waiting for a clinician.` },
    { id: 'dl-devices', n: '04', title: 'Devices', text: `${numbers.online} of ${numbers.devices} devices online now.` },
  ];
  const maxDay = Math.max(1, ...numbers.byDay.map((d) => d.synced + d.conflicts));
  const splitMax = Math.max(1, numbers.auto, numbers.manual, numbers.pending);
  const reviewMax = Math.max(1, ...numbers.byDay.map((d) => d.conflicts));
  const sparkMax = Math.max(1, ...numbers.byDay.map((d) => d.synced + d.conflicts));
  const sparkLine = numbers.byDay.length
    ? numbers.byDay
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${((i / Math.max(1, numbers.byDay.length - 1)) * 300).toFixed(1)},${(76 - ((d.synced + d.conflicts) / sparkMax) * 68).toFixed(1)}`)
        .join(' ')
    : 'M0,76 L300,76';

  return (
    <div className="dl" ref={rootRef} aria-label="District overview">
      {/* the scene: real photographs, one per chapter, crossfading and drifting */}
      <div className="dl-scene" aria-hidden="true">
        {SCENES.map((s, i) => (
          <div
            key={s.src}
            className={`dl-photo ${chapter === i ? 'is-on' : ''}`}
            style={{
              backgroundImage: `url(${s.src})`,
              backgroundPosition: s.pos,
              transform: `scale(${1.08 + drift * 0.12}) translate3d(0, ${drift * -2}%, 0)`,
            }}
          />
        ))}
        <div className="dl-vignette" />
        <div className="dl-grain" />
      </div>

      <nav className="dl-rail" aria-label="Chapters">
        <div className="dl-rail-in">
          {['dl-hero', ...chips.map((c) => c.id)].map((id, i) => (
            <button key={id} type="button" className={chapter === i ? 'on' : ''} onClick={() => goTo(id)} aria-label={`Go to chapter ${i}`}>
              <i />
            </button>
          ))}
        </div>
      </nav>

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="dl-hero" id="dl-hero" data-scene>
        <div className="dl-hero-top">
          <div className="dl-eyebrow" data-rv="fade">
            <span className="dl-dot" /> Chapter 00 — District overview
          </div>
          <h1 className="dl-display dl-h-hero" data-rv="up">
            <Words text="Every record," />
            <br />
            <Words text="every PHC," delay={160} />
            <br />
            <Words text="one district." delay={320} />
          </h1>
          <p className="dl-body dl-hero-sub" data-rv="up">
            {numbers.patients} patients, {numbers.phcs} primary health centres and {numbers.devices} devices, merged field by field. Nothing clinical is
            guessed.
          </p>
        </div>
        <div className="dl-hero-spacer" />
        <div className="dl-hero-foot">
          <div className="dl-cue" data-rv="fade">
            <span>Scroll to enter</span>
            <span className="dl-track">
              <i />
            </span>
            <button type="button" className="dl-skip" onClick={skip}>
              Skip to dashboard
            </button>
          </div>
          <div className="dl-chapters">
            {chips.map((c) => (
              <button key={c.id} type="button" className="dl-chip" data-rv="up" onClick={() => goTo(c.id)}>
                <span className="dl-num">{c.n}</span>
                <span className="dl-chip-tx">
                  <b>{c.title}</b>
                  <span>{c.text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="dl-peek" data-rv="fade" onClick={() => goTo('dl-merges')}>
          <span className="dl-peek-fr" style={{ backgroundImage: 'url(/landing/ward.webp)' }} />
          <span className="dl-peek-cap">
            <b>General ward</b>
            <i>{numbers.weekSynced} changes this week</i>
          </span>
        </button>
        <div className="dl-side" aria-hidden="true">
          HEALTHSYNC
        </div>
      </section>

      {/* ── 01 · patients ────────────────────────────────────────────────── */}
      <section className="dl-sec" id="dl-patients" data-scene>
        <div className="dl-sec-head" data-rv="fade">
          <span className="dl-k">
            <b>01</b> — Registered patients
          </span>
          <span className="dl-rule" />
          <span className="dl-k">Reception</span>
        </div>
        <div className="dl-story">
          <h2 className="dl-display dl-h-sec" data-rv="up">
            {numbers.phcs} health centres. One register.
          </h2>
          <div className="dl-story-copy">
            <p className="dl-lead" data-rv="up">
              Every visit starts on a PHC tablet, encrypted on the device, and reaches the district the moment a connection returns.
              {numbers.busiest ? ` ${numbers.busiest.name} holds the largest register, with ${numbers.busiest.patientCount} patients.` : ''}
            </p>
            <Link className="dl-arrowlink" to="/phcs" data-rv="fade">
              <span>Open the PHC library</span>
              <span className="dl-ar">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>
        <div className="dl-stats" data-rv="up">
          <div>
            <b>{pad2(numbers.patients)}</b>
            <span>Patients</span>
          </div>
          <div>
            <b>{pad2(numbers.phcs)}</b>
            <span>PHCs</span>
          </div>
          <div>
            <b>{pad2(numbers.staff)}</b>
            <span>PHC staff</span>
          </div>
          <div>
            <b>{pad2(numbers.weekSynced)}</b>
            <span>Changes · 7 days</span>
          </div>
        </div>
      </section>

      {/* ── 02 · merges ──────────────────────────────────────────────────── */}
      <section className="dl-sec" id="dl-merges" data-scene>
        <div className="dl-sec-head" data-rv="fade">
          <span className="dl-k">
            <b>02</b> — Merges
          </span>
          <span className="dl-rule" />
          <span className="dl-k">Wards</span>
        </div>
        <div className="dl-mosaic">
          {/* 01 · how concurrent edits were settled, and the week's flow of changes */}
          <article className="dl-card dl-card-lead" data-rv="up">
            <div className="dl-panel">
              <div className="dl-panel-head">
                <b>Merged automatically</b>
                <span className="dl-card-big">{numbers.auto}</span>
              </div>
              <div className="dl-split" role="img" aria-label={`Settled automatically ${numbers.auto}, by clinicians ${numbers.manual}, waiting ${numbers.pending}`}>
                {[
                  { label: 'Automatic (CRDT rules)', value: numbers.auto, tone: 'sage' },
                  { label: 'Decided by clinicians', value: numbers.manual, tone: 'navy' },
                  { label: 'Waiting for review', value: numbers.pending, tone: 'orange' },
                ].map((r) => (
                  <div key={r.label} className="dl-split-row">
                    <span className="dl-split-label">{r.label}</span>
                    <span className="dl-split-track">
                      <i className={`dl-tone-${r.tone}`} style={{ width: `${(r.value / splitMax) * 100}%` }} />
                    </span>
                    <span className="dl-split-val">{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="dl-spark">
                <span className="dl-k">Changes reaching the district · last 7 days</span>
                <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="dl-spark-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#5faf98" stopOpacity="0.45" />
                      <stop offset="1" stopColor="#5faf98" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkLine} L300,80 L0,80 Z`} fill="url(#dl-spark-fill)" />
                  <path d={sparkLine} fill="none" stroke="#8cc7b5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="dl-spark-days">
                  {numbers.byDay.map((d) => (
                    <span key={d.date}>{new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="dl-card-meta">
              <span>Concurrent edits settled by the CRDT rules</span>
              <span>01 / 03</span>
            </div>
          </article>

          {/* 02 · resolution rate as a gauge */}
          <article className="dl-card" data-rv="up">
            <div className="dl-panel dl-panel-center">
              <svg className="dl-gauge" viewBox="0 0 120 120" role="img" aria-label={`${numbers.rate}% resolved without a human`}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(236,231,218,0.12)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#5faf98"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(numbers.rate / 100) * 314.16} 314.16`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="66" textAnchor="middle" className="dl-gauge-num">
                  {numbers.rate}%
                </text>
              </svg>
              <div className="dl-panel-foot">
                <b>Resolution rate</b>
                <span>
                  {numbers.auto} of {numbers.auto + numbers.manual + numbers.pending} concurrent edits
                </span>
              </div>
            </div>
            <div className="dl-card-meta">
              <span>Resolved without a human</span>
              <span>02 / 03</span>
            </div>
          </article>

          {/* 03 · dose clashes per day */}
          <article className="dl-card" data-rv="up">
            <div className="dl-panel">
              <div className="dl-panel-head">
                <b>Sent to review</b>
                <span className="dl-card-big">{numbers.weekReview}</span>
              </div>
              <div className="dl-cols" role="img" aria-label={`Dose clashes per day: ${numbers.byDay.map((d) => d.conflicts).join(', ')}`}>
                {numbers.byDay.map((d) => (
                  <span key={d.date} className="dl-col">
                    <i style={{ height: `${Math.max(3, (d.conflicts / reviewMax) * 100)}%` }} />
                    <em>{new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</em>
                  </span>
                ))}
              </div>
            </div>
            <div className="dl-card-meta">
              <span>Dose clashes this week</span>
              <span>03 / 03</span>
            </div>
          </article>
        </div>
      </section>

      {/* ── 03 · reviews ─────────────────────────────────────────────────── */}
      <section className="dl-sec" id="dl-reviews" data-scene>
        <div className="dl-sec-head" data-rv="fade">
          <span className="dl-k">
            <b>03</b> — Clinical review
          </span>
          <span className="dl-rule" />
          <span className="dl-k">Theatre</span>
        </div>
        <div className="dl-cur-head">
          <h2 className="dl-display dl-h-sec" data-rv="up">
            Doses are never guessed.
          </h2>
          <p className="dl-body-lg" data-rv="up">
            When two devices change the same medication while offline, the case waits here for a clinician. Every decision lands in the
            append-only audit trail.
          </p>
        </div>
        <div className="dl-atlas">
          <Link to="/conflicts" className="dl-plate" data-rv="up">
            <span className="dl-k">01</span>
            <h3>Awaiting review</h3>
            <p className="dl-plate-num">{numbers.pending}</p>
            <span className="dl-t">Open conflict review →</span>
          </Link>
          <div className="dl-plate" data-rv="up">
            <span className="dl-k">02</span>
            <h3>Resolved by clinicians</h3>
            <p className="dl-plate-num">{numbers.resolved}</p>
            <span className="dl-t">{numbers.manual} manual decisions</span>
          </div>
          <div className="dl-plate" data-rv="up">
            <span className="dl-k">03</span>
            <h3>Automatic</h3>
            <p className="dl-plate-num">{numbers.auto}</p>
            <span className="dl-t">LWW · OR-Set · G-Set</span>
          </div>
          <div className="dl-plate" data-rv="up">
            <span className="dl-k">04</span>
            <h3>Auto-resolution</h3>
            <p className="dl-plate-num">{numbers.rate}%</p>
            <span className="dl-t">of concurrent edits</span>
          </div>
          <div className="dl-plate dl-plate-chart" data-rv="up">
            <span className="dl-k">05</span>
            <h3>Last 7 days</h3>
            <div className="dl-bars" role="img" aria-label={`Changes per day: ${numbers.byDay.map((d) => d.synced + d.conflicts).join(', ')}`}>
              {numbers.byDay.map((d) => (
                <span key={d.date} style={{ height: `${Math.max(4, ((d.synced + d.conflicts) / maxDay) * 100)}%` }}>
                  {d.conflicts > 0 && <i style={{ height: `${(d.conflicts / (d.synced + d.conflicts)) * 100}%` }} />}
                </span>
              ))}
            </div>
            <span className="dl-t">Synced · sent to review</span>
          </div>
        </div>
      </section>

      {/* ── 04 · devices / close ─────────────────────────────────────────── */}
      <section className="dl-sec dl-fin" id="dl-devices" data-scene>
        <div className="dl-eyebrow" data-rv="fade">
          Chapter 04 — Devices
        </div>
        <h2 className="dl-display" data-rv="up">
          {numbers.devices} devices
        </h2>
        <p className="dl-body-lg" data-rv="up">
          {numbers.online} of them are online right now. Every PHC device keeps working offline and catches up with the district the moment it can.
        </p>
        <div className="dl-ctas" data-rv="fade">
          <Link className="dl-cta" to="/admin">
            <i />
            <span>Users &amp; devices</span>
            <Arrow />
          </Link>
          <button type="button" className="dl-cta" onClick={skip}>
            <i />
            <span>Go to the dashboard</span>
            <Arrow />
          </button>
        </div>
        <p className="dl-credit">Photographs: Unsplash (National Cancer Institute, Fabio Sasso, Adhy Savala, Alexander Mass).</p>
      </section>
    </div>
  );
}

/**
 * PhcIntro — illustrated opening before the ID passes drop in, driven by the
 * scroll wheel. Two-tone scene in the ID-card palette: a doctor at a PHC desk
 * with a nurse beside her. Scrolling pushes the camera in to the tablet on the
 * desk, a patient record builds on its screen and syncs out, and scrolling on
 * past the end clears the scene for the passes. Plays once per browser
 * session; Skip (or Escape) ends it at any time.
 */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

const SEEN_KEY = 'hs-intro-seen';
const SCROLL_LENGTH_VH = 420;

const CAPTIONS = [
  { n: '01', title: 'Recorded at the PHC', text: 'Every visit is entered on the spot, at the desk or the bedside.' },
  { n: '02', title: 'Saved on the device', text: 'Encrypted on the tablet first, so nothing waits for the network.' },
  { n: '03', title: 'Merged when back online', text: 'Edits sync field by field. Allergies are kept; dose clashes go to a reviewer.' },
];

export function shouldPlayIntro(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
  } catch {
    // storage blocked: still play
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Camera zoom for a scroll position: hold the room, push in to the tablet, then through it. */
function cameraScale(p: number): number {
  if (p < 0.22) return 1.08 - 0.06 * (p / 0.22);
  if (p < 0.58) return 1.02 + (4.1 - 1.02) * easeInOut((p - 0.22) / 0.36);
  if (p < 0.84) return 4.1 + 0.4 * ((p - 0.58) / 0.26);
  return 4.5 + (11 - 4.5) * Math.pow((p - 0.84) / 0.16, 2);
}

export function PhcIntro({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0); // which caption / screen line is showing
  const finishRef = useRef<() => void>(() => undefined);
  const camRef = useRef<SVGGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    window.scrollTo(0, 0);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setLeaving(true);
      setTimeout(() => {
        window.scrollTo(0, 0);
        onDone();
      }, 520);
    };
    finishRef.current = finish;

    let target = 0;
    let cur = 0;
    let raf = 0;
    let lastStep = -1;
    const read = () => {
      const span = (spacerRef.current?.offsetHeight ?? 0) - window.innerHeight;
      target = span > 0 ? clamp01(window.scrollY / span) : 0;
    };
    const frame = () => {
      cur += (target - cur) * 0.12;
      if (Math.abs(target - cur) < 0.0005) cur = target;
      if (camRef.current) camRef.current.style.transform = `scale(${cameraScale(cur)})`;
      if (rootRef.current) rootRef.current.style.setProperty('--p', cur.toFixed(4));
      // 0-2: captions; 3+: lines on the tablet screen; 8: sync pulses
      const s = cur < 0.3 ? 0 : cur < 0.62 ? 1 : 2;
      const lines = cur < 0.5 ? 0 : Math.min(5, Math.floor((cur - 0.5) / 0.05) + 1);
      const code = s * 10 + lines;
      if (code !== lastStep) {
        lastStep = code;
        setStep(code);
      }
      if (cur > 0.985) finish();
      raf = requestAnimationFrame(frame);
    };
    read();
    raf = requestAnimationFrame(frame);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
      document.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  const skip = () => finishRef.current();
  const caption = Math.floor(step / 10);
  const lines = step % 10;

  return (
    <>
    <div ref={spacerRef} style={{ height: `${SCROLL_LENGTH_VH}vh` }} aria-hidden="true" />
    <div ref={rootRef} className={`phc-intro ${leaving ? 'is-leaving' : ''}`} role="presentation">
      <svg className="phc-intro-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <clipPath id="pi-window">
            <rect x="90" y="110" width="430" height="440" />
          </clipPath>
          <clipPath id="pi-screen">
            <rect x="742" y="586" width="156" height="104" rx="4" />
          </clipPath>
          <pattern id="pi-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="6" fill="#2b3d55" opacity="0.18" />
          </pattern>
        </defs>

        <g className="pi-cam" ref={camRef}>
          {/* Back wall and floor */}
          <rect width="1600" height="900" fill="#ece7da" />
          <polygon points="0,720 1600,720 1600,900 0,900" fill="#2b3d55" />
          <polygon points="0,720 1600,720 1600,736 0,736" fill="#1d2733" />
          {/* Sun patch from the window */}
          <polygon points="120,720 560,720 760,900 260,900" fill="#ece7da" opacity="0.14" />

          {/* Window with the village outside */}
          <g clipPath="url(#pi-window)">
            <rect x="90" y="110" width="430" height="440" fill="#f4efe3" />
            <circle className="pi-sun" cx="420" cy="215" r="34" fill="#e0663a" />
            <path d="M90 410 Q180 340 270 392 T450 372 T560 400 V560 H90Z" fill="#8a9bad" />
            <path d="M90 450 Q210 400 330 440 T560 430 V560 H90Z" fill="#4f6378" />
            {/* PHC building outside */}
            <rect x="300" y="418" width="120" height="70" fill="#ece7da" />
            <polygon points="292,420 360,384 428,420" fill="#2b3d55" />
            <rect x="348" y="448" width="22" height="40" fill="#2b3d55" />
            <rect x="314" y="432" width="20" height="16" fill="#2b3d55" />
            <rect x="386" y="432" width="20" height="16" fill="#2b3d55" />
            <rect x="352" y="396" width="14" height="14" fill="#e0663a" />
            <rect x="357" y="399" width="4" height="8" fill="#ece7da" />
            <rect x="355" y="401" width="8" height="4" fill="#ece7da" />
            {/* Palm */}
            <path d="M170 520 Q176 450 166 400" stroke="#1d2733" strokeWidth="7" fill="none" />
            <path d="M166 402 q-46 -6 -70 18 M166 402 q-40 -30 -78 -22 M166 402 q20 -40 64 -40 M166 402 q42 -6 64 22 M166 402 q-6 -42 -30 -60" stroke="#1d2733" strokeWidth="9" fill="none" strokeLinecap="round" />
            <rect x="90" y="500" width="430" height="60" fill="#2b3d55" />
          </g>
          <rect x="90" y="110" width="430" height="440" fill="none" stroke="#1d2733" strokeWidth="14" />
          <line x1="305" y1="110" x2="305" y2="550" stroke="#1d2733" strokeWidth="9" />
          <line x1="90" y1="330" x2="520" y2="330" stroke="#1d2733" strokeWidth="9" />
          <rect x="74" y="550" width="462" height="16" fill="#1d2733" />

          {/* Wall chart and medicine shelf */}
          <rect x="620" y="150" width="150" height="196" fill="#f4efe3" stroke="#2b3d55" strokeWidth="5" />
          <rect x="676" y="168" width="38" height="38" fill="#e0663a" />
          <rect x="689" y="174" width="12" height="26" fill="#f4efe3" />
          <rect x="682" y="181" width="26" height="12" fill="#f4efe3" />
          {[226, 246, 266, 286, 306].map((y, i) => (
            <rect key={y} x="642" y={y} width={[106, 84, 98, 70, 90][i]} height="7" fill="#2b3d55" opacity="0.55" />
          ))}
          <rect x="1180" y="190" width="300" height="12" fill="#1d2733" />
          <rect x="1180" y="300" width="300" height="12" fill="#1d2733" />
          {[1196, 1230, 1262, 1300, 1342, 1380, 1420, 1450].map((x, i) => (
            <rect key={x} x={x} y={190 - [46, 34, 52, 40, 30, 48, 36, 44][i]} width={[24, 22, 28, 30, 26, 22, 20, 18][i]} height={[46, 34, 52, 40, 30, 48, 36, 44][i]} fill={i % 3 === 1 ? '#e0663a' : '#2b3d55'} />
          ))}
          {[1200, 1246, 1290, 1340, 1392, 1440].map((x, i) => (
            <rect key={x} x={x} y={300 - [40, 54, 36, 46, 30, 50][i]} width="34" height={[40, 54, 36, 46, 30, 50][i]} fill={i === 3 ? '#e0663a' : '#4f6378'} />
          ))}

          {/* Big diagonal shadow over the wall (the two-tone look) */}
          <polygon points="1040,0 1600,0 1600,720 1310,720" fill="url(#pi-hatch)" />

          {/* Nurse standing (right) */}
          <g className="pi-nurse">
            <rect x="1262" y="470" width="96" height="250" rx="40" fill="#f4efe3" stroke="#1d2733" strokeWidth="5" />
            <path d="M1262 560 h96 v160 h-96z" fill="#2b3d55" />
            <rect x="1288" y="618" width="16" height="104" fill="#1d2733" />
            <rect x="1318" y="618" width="16" height="104" fill="#1d2733" />
            <circle cx="1310" cy="430" r="38" fill="#e7c9a8" stroke="#1d2733" strokeWidth="5" />
            <path d="M1272 424 q38 -58 76 0 q-10 -26 -38 -28 q-28 2 -38 28z" fill="#1d2733" />
            <rect x="1290" y="382" width="40" height="18" rx="3" fill="#f4efe3" stroke="#1d2733" strokeWidth="4" />
            <rect x="1306" y="385" width="8" height="12" fill="#e0663a" />
            <rect x="1304" y="387" width="12" height="8" fill="#e0663a" />
            {/* clipboard */}
            <rect x="1226" y="540" width="56" height="74" rx="4" fill="#e0663a" stroke="#1d2733" strokeWidth="4" />
            <rect x="1236" y="552" width="36" height="52" fill="#f4efe3" />
            <path d="M1262 520 q-30 30 -18 62" stroke="#f4efe3" strokeWidth="16" fill="none" strokeLinecap="round" />
          </g>

          {/* Doctor seated behind the desk */}
          <g className="pi-doctor">
            <path d="M900 560 q0 -120 100 -120 q100 0 100 120 v160 h-200z" fill="#f4efe3" stroke="#1d2733" strokeWidth="5" />
            <path d="M1000 440 l-24 120 l24 -30 l24 30z" fill="#4f6378" />
            {/* stethoscope */}
            <path d="M966 452 q-10 70 22 96 q30 10 44 -16 q12 -40 4 -80" stroke="#e0663a" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="1036" cy="540" r="10" fill="#e0663a" stroke="#1d2733" strokeWidth="4" />
            <circle cx="1000" cy="392" r="44" fill="#e7c9a8" stroke="#1d2733" strokeWidth="5" />
            <path d="M956 392 q0 -58 46 -58 q50 0 48 54 q-18 -30 -50 -30 q-26 0 -44 34z" fill="#1d2733" />
            <circle cx="1046" cy="388" r="14" fill="#1d2733" />
          </g>

          {/* Desk */}
          <polygon points="560,620 1500,620 1560,700 500,700" fill="#f4efe3" stroke="#1d2733" strokeWidth="5" />
          <polygon points="500,700 1560,700 1560,724 500,724" fill="#1d2733" />
          <rect x="560" y="724" width="36" height="176" fill="#1d2733" />
          <rect x="1464" y="724" width="36" height="176" fill="#1d2733" />
          <polygon points="1040,620 1500,620 1560,700 1150,700" fill="url(#pi-hatch)" />
          {/* mug and pen pot */}
          <rect x="1120" y="590" width="40" height="44" rx="4" fill="#e0663a" stroke="#1d2733" strokeWidth="4" />
          <rect x="1300" y="600" width="30" height="34" fill="#2b3d55" />
          <line x1="1308" y1="600" x2="1300" y2="566" stroke="#1d2733" strokeWidth="4" />
          <line x1="1320" y1="600" x2="1330" y2="570" stroke="#e0663a" strokeWidth="4" />

          {/* Tablet on the desk */}
          <g className="pi-tablet">
            <rect x="730" y="576" width="180" height="124" rx="10" fill="#1d2733" />
            <rect x="742" y="586" width="156" height="104" rx="4" fill="#f4efe3" />
            <g clipPath="url(#pi-screen)" className="pi-screen">
              <rect x="742" y="586" width="156" height="14" fill="#2b3d55" />
              <rect x="747" y="590" width="6" height="6" rx="1.5" fill="#e0663a" />
              <text x="757" y="596" fontSize="5.5" fontWeight="700" fill="#ece7da" fontFamily="Geist Mono, monospace" letterSpacing="0.6">HEALTHSYNC</text>
              <g className={`pi-l1 ${lines > 0 ? 'is-on' : ''}`}>
                <text x="748" y="613" fontSize="10" fontWeight="800" fill="#1d2733" fontFamily="Geist, Inter, sans-serif">Asha Patil</text>
                <text x="748" y="621" fontSize="5" fill="#4f6378" fontFamily="Geist Mono, monospace">42 YRS · F · B+ · PHC WAGHOLI</text>
              </g>
              <g className={`pi-l2 ${lines > 1 ? 'is-on' : ''}`}>
                <rect x="748" y="627" width="30" height="8" rx="2" fill="#e0663a" />
                <text x="751" y="633" fontSize="4.6" fontWeight="700" fill="#fff8f0" fontFamily="Geist Mono, monospace">PENICILLIN</text>
                <rect x="781" y="627" width="22" height="8" rx="2" fill="#f0a63a" />
                <text x="784" y="633" fontSize="4.6" fontWeight="700" fill="#1d2733" fontFamily="Geist Mono, monospace">LATEX</text>
              </g>
              <g className={`pi-l3 ${lines > 2 ? 'is-on' : ''}`}>
                {[['HR', '82'], ['BP', '132/86'], ['SPO2', '98']].map(([k, v], i) => (
                  <g key={k}>
                    <rect x={748 + i * 48} y="641" width="44" height="18" rx="2" fill="#e2dccb" />
                    <text x={751 + i * 48} y="648" fontSize="4" fill="#4f6378" fontFamily="Geist Mono, monospace">{k}</text>
                    <text x={751 + i * 48} y="656" fontSize="7" fontWeight="700" fill="#1d2733" fontFamily="Geist Mono, monospace">{v}</text>
                  </g>
                ))}
              </g>
              <g className={`pi-l4 ${lines > 3 ? 'is-on' : ''}`}>
                <rect x="748" y="664" width="144" height="18" rx="3" fill="#1d2733" />
                <text x="754" y="675.5" fontSize="5.5" fontWeight="600" fill="#f0a063" fontFamily="Geist Mono, monospace">METFORMIN · 500 MG · BD</text>
              </g>
              <g className={`pi-sync ${lines > 4 ? 'is-on' : ''}`}>
                <circle cx="880" cy="613" r="7" fill="#e0663a" />
                <path d="M876.5 613 a3.5 3.5 0 1 1 1 2.6 M876.5 613 l-1.6 -1.6 M876.5 613 l1.8 -1.4" stroke="#fff8f0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </g>
            </g>
          </g>

          {/* Sync pulses rising from the tablet */}
          <g className={`pi-pulses ${lines >= 5 ? 'is-on' : ''}`} fill="none" stroke="#e0663a" strokeWidth="2.5">
            <circle cx="820" cy="636" r="40" />
            <circle cx="820" cy="636" r="40" />
            <circle cx="820" cy="636" r="40" />
          </g>
        </g>
      </svg>

      <div className="phc-intro-captions">
        {CAPTIONS.map((c, i) => (
          <div key={c.n} className={`phc-intro-caption ${caption === i ? 'is-on' : ''}`} aria-hidden={caption !== i}>
            <span className="phc-intro-n">{c.n}</span>
            <p className="phc-intro-title">{t(c.title)}</p>
            <p className="phc-intro-text">{t(c.text)}</p>
          </div>
        ))}
      </div>

      <div className="phc-intro-cue" aria-hidden="true">
        <span>{t('Scroll to begin')}</span>
        <span className="phc-intro-track"><i /></span>
      </div>
      <div className="phc-intro-progress" aria-hidden="true"><i /></div>

      <button type="button" className="phc-intro-skip" onClick={skip}>
        {t('Skip intro')}
      </button>
    </div>
    </>
  );
}

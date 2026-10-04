/**
 * BootLoader — full-screen "uplink" loading sequence shown while the app opens
 * its encrypted store and runs the first sync (on launch, and again right after
 * signing in). Progress follows the real sync engine: it creeps toward a cap for
 * the current stage, then runs to 100% and fades out once the first sync is done
 * (or the device turns out to be offline, in which case local records are ready).
 */
import { useEffect, useRef, useState } from 'react';
import { syncEngine } from '../sync/syncEngine';
import { getSession, onSessionChange } from '../lib/authStore';
import './BootLoader.css';

const TICKS = 56;
const MARK_EVERY = 8;
const MIN_VISIBLE_MS = 1400; // long enough to read, short enough not to get in the way
const MAX_WAIT_MS = 7000; // never block the app on a slow server

type Stage = 'store' | 'connecting' | 'syncing' | 'done' | 'offline';

const STAGE_CAP: Record<Stage, number> = { store: 22, connecting: 52, syncing: 90, done: 100, offline: 100 };
const STAGE_TEXT: Record<Stage, string> = {
  store: 'UNLOCKING ENCRYPTED STORE',
  connecting: 'CONNECTING TO SYNC SERVER',
  syncing: 'SYNCING PATIENT RECORDS',
  done: 'RECORDS UP TO DATE',
  offline: 'OFFLINE · LOCAL RECORDS READY',
};

function noiseTile(fn: (d: Uint8ClampedArray, o: number) => void): string {
  const N = 160;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) fn(img.data, i * 4);
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/** Watches the sync engine and reports which boot stage we are in. */
function useBootStage(): Stage {
  const [stage, setStage] = useState<Stage>('store');
  useEffect(() => {
    const startedAt = Date.now();
    let sawSync = false;
    const evaluate = () => {
      const s = syncEngine.state;
      if (!getSession()) return setStage(Date.now() - startedAt > 500 ? 'done' : 'store');
      if (s.status === 'offline' || s.status === 'error') return setStage('offline');
      if (s.status === 'syncing') {
        sawSync = true;
        return setStage('syncing');
      }
      if (s.status === 'idle' && s.connected) return setStage(sawSync ? 'done' : 'syncing');
      if (s.status === 'connecting') return setStage('connecting');
    };
    evaluate();
    const unsub = syncEngine.subscribe(evaluate);
    const tick = setInterval(evaluate, 250);
    const giveUp = setTimeout(() => setStage((st) => (st === 'done' ? st : 'offline')), MAX_WAIT_MS);
    return () => {
      unsub();
      clearInterval(tick);
      clearTimeout(giveUp);
    };
  }, []);
  return stage;
}

export function BootLoader() {
  // Show on launch, and again whenever someone signs in. Each run is a fresh
  // mount (new key), so its stage and progress start from zero.
  const [run, setRun] = useState(1);
  // Signed-out visitors get the sign-in intro instead of the loader.
  const [mounted, setMounted] = useState(() => Boolean(getSession()));
  useEffect(
    () =>
      onSessionChange((s) => {
        if (s) {
          setRun((r) => r + 1);
          setMounted(true);
        }
      }),
    [],
  );
  if (!mounted) return null;
  return <LoaderRun key={run} onDone={() => setMounted(false)} />;
}

function LoaderRun({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const stage = useBootStage();
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLElement>(null);
  const hazeRef = useRef<HTMLElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLSpanElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const grain2Ref = useRef<HTMLDivElement>(null);

  // Scale the 1200x800 design canvas to the viewport.
  useEffect(() => {
    const fit = () => rootRef.current?.style.setProperty('--s', String(Math.min(innerWidth / 1200, innerHeight / 800)));
    fit();
    addEventListener('resize', fit, { passive: true });
    return () => removeEventListener('resize', fit);
  }, []);

  // Film grain tiles (generated once per mount).
  useEffect(() => {
    const g = () => (Math.random() + Math.random() + Math.random() + Math.random()) / 4;
    if (grainRef.current)
      grainRef.current.style.backgroundImage = `url(${noiseTile((d, o) => {
        const v = 128 + (g() - 0.5) * 300;
        d[o] = d[o + 1] = d[o + 2] = Math.max(0, Math.min(255, v));
        d[o + 3] = 255;
      })})`;
    if (grain2Ref.current)
      grain2Ref.current.style.backgroundImage = `url(${noiseTile((d, o) => {
        const v = Math.random();
        d[o] = d[o + 1] = d[o + 2] = 255;
        d[o + 3] = v < 0.86 ? 0 : Math.round(((v - 0.86) / 0.14) * 190);
      })})`;
  }, []);

  // The animation loop: progress creeps toward the current stage's cap.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.replaceChildren();
    const ticks: HTMLElement[] = [];
    for (let i = 0; i < TICKS; i++) {
      const t = document.createElement('i');
      t.className = 'tick' + ((i + 1) % MARK_EVERY === 0 ? ' mk' : '');
      bar.appendChild(t);
      ticks.push(t);
    }
    const barW = 604;
    const tickW = 5.4;
    const gap = (barW - TICKS * tickW) / (TICKS - 1);
    const pitch = tickW + gap;

    const start = performance.now();
    let pct = 0;
    let last = start;
    let lastLit = -1;
    let lastShown = -1;
    let lastDots = -1;
    let lastText = '';
    let finishedAt = 0;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const st = stageRef.current;
      const finishing = (st === 'done' || st === 'offline') && now - start >= MIN_VISIBLE_MS * 0.6;
      const cap = finishing ? 100 : Math.min(STAGE_CAP[st], 97);
      // Ease toward the cap; faster when finishing so the bar "lands" crisply.
      const rate = finishing ? 0.012 : 0.0028;
      pct += (cap - pct) * (1 - Math.exp(-rate * dt));
      if (finishing && cap - pct < 0.4) pct = 100;

      const shown = Math.round(pct);
      if (shown !== lastShown && numRef.current) {
        numRef.current.textContent = String(shown);
        lastShown = shown;
      }
      const signedIn = Boolean(getSession());
      const text = !signedIn
        ? shown >= 100
          ? 'DEVICE READY'
          : 'PREPARING THIS DEVICE'
        : shown >= 100
          ? STAGE_TEXT[st === 'offline' ? 'offline' : 'done']
          : STAGE_TEXT[st === 'done' || st === 'offline' ? 'syncing' : st];
      if (text !== lastText && statusRef.current) {
        statusRef.current.textContent = text;
        lastText = text;
      }

      const lit = Math.round((pct / 100) * TICKS);
      if (lit !== lastLit) {
        for (let i = 0; i < TICKS; i++) ticks[i].classList.toggle('on', i < lit);
        if (lit > lastLit && lastLit >= 0 && lit > 0) {
          const h = ticks[lit - 1];
          h.classList.remove('flash');
          void h.offsetWidth;
          h.classList.add('flash');
          const haze = hazeRef.current;
          if (haze) {
            haze.classList.remove('pulse');
            void haze.offsetWidth;
            haze.classList.add('pulse');
          }
        }
        hazeRef.current?.style.setProperty('--lit-w', (lit > 0 ? (lit - 1) * pitch + tickW + gap / 2 : 0) + 'px');
        if (lit === TICKS && plateRef.current) {
          plateRef.current.classList.remove('hit');
          void plateRef.current.offsetWidth;
          plateRef.current.classList.add('hit');
        }
        lastLit = lit;
      }

      const d = shown >= 100 ? 0 : Math.floor(((now - start) / 380) % 4);
      if (d !== lastDots && dotsRef.current) {
        dotsRef.current.textContent = '...'.slice(0, d);
        lastDots = d;
      }

      if (pct >= 100) {
        if (!finishedAt) finishedAt = now;
        // Hold on 100% briefly, then fade out and unmount.
        if (now - finishedAt > 380 && now - start >= MIN_VISIBLE_MS) {
          setVisible(false);
          setTimeout(() => doneRef.current(), 480);
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const marker = (cls: string) => (
    <div className={`marker ${cls}`}>
      <i className="h a-h" /><i className="v a-v" /><i className="h b-h" /><i className="v b-v" />
      <i className="h c-h" /><i className="v c-v" /><i className="h d-h" /><i className="v d-v" />
      <i className="dia" />
    </div>
  );
  const rail = (side: 'left' | 'right') => (
    <div className={`rail ${side}`}>
      <div className="wire" /><div className="cap a" /><div className="cap b" />
      <div className="mod">
        <div className="hatch" /><div className="ret" /><div className="dot" /><div className="slab" />
        <i className="led" /><i className="led" /><i className="led" /><i className="led" />
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`hs-loader ${visible ? '' : 'is-done'}`}
      role="progressbar"
      aria-label="Loading HealthSync"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy={visible}
    >
      <div className="pool" />
      <div className="scene">
        <div className="stage">
          <div className="brand">
            <img src="/favicon.svg" alt="" />
            HealthSync
          </div>
          <div className="haze"><i ref={hazeRef} /></div>
          <div className="plate" ref={plateRef} />
          <div className="brk tr" /><div className="brk bl" />
          <div className="readout"><b ref={numRef}>0</b><u>%</u></div>
          <div className="barlabel">SYNC</div>
          <div className="bar" ref={barRef} />
          <div className="status" aria-live="polite">
            <span ref={statusRef}>{STAGE_TEXT.store}</span>
            <span className="dots" ref={dotsRef}>...</span>
          </div>
          {marker('m-tl')}{marker('m-tr')}{marker('m-bl')}{marker('m-br')}
          {rail('left')}{rail('right')}
        </div>
      </div>
      <div className="scan" />
      <div className="grain mul" ref={grainRef} />
      <div className="grain add" ref={grain2Ref} />
    </div>
  );
}

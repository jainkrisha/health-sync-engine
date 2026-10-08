/**
 * CaseWave — review cases as an interactive card wave (ported from the
 * "Character Wave" carousel), in the HealthSync palette. Move the pointer to
 * sweep through the cases, scroll or use the arrow keys to step one case at a
 * time, and pick the front card to open that case.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Conflict } from '@shared/types';
import { relativeTime } from '../../components/ui';
import './caseWave.css';

const CARD_COLORS = ['#2b3d55', '#34485f', '#3c5f50', '#2f4257', '#3a4b5e', '#283a4f', '#423d35', '#31455a'];
const STEP_COOLDOWN_MS = 320; // one case per scroll gesture, never a blur

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function dose(c: Conflict, side: 'current' | 'incoming') {
  const v = side === 'current' ? c.currentValue : c.incomingValue;
  return v.active ? v.dosage || '—' : 'Stopped';
}

export function CaseWave({ cases, onOpen }: { cases: Conflict[]; onOpen: (c: Conflict) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  });

  // The wave needs enough cards to read as a wave; short lists repeat.
  const deck = useMemo(() => {
    if (cases.length === 0) return [];
    const out: { c: Conflict; key: string; echo: boolean }[] = cases.map((c) => ({ c, key: c.id, echo: false }));
    let i = 0;
    while (out.length < 9) {
      const c = cases[i % cases.length];
      out.push({ c, key: `${c.id}-echo-${i}`, echo: true });
      i++;
    }
    return out;
  }, [cases]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || deck.length === 0) return;
    const cards = cardRefs.current.slice(0, deck.length).filter((c): c is HTMLButtonElement => Boolean(c));
    const count = cards.length;
    const narrow = () => stage.clientWidth < 680;
    const state = {
      phase: 0,
      targetPhase: 0,
      basePhase: 0,
      orientation: narrow() ? 1 : 0,
      targetOrientation: narrow() ? 1 : 0,
      pointerX: 0,
      pointerY: 0,
      tiltX: 0,
      tiltY: 0,
      active: false,
      lastInput: performance.now(),
      lastStep: 0,
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const wrappedDelta = (index: number, phase: number) => {
      let d = index - phase;
      while (d > count / 2) d -= count;
      while (d < -count / 2) d += count;
      return d;
    };
    const nearest = () => ((Math.round(state.phase) % count) + count) % count;
    const select = (index: number) => {
      let d = index - nearest();
      if (d > count / 2) d -= count;
      if (d < -count / 2) d += count;
      state.basePhase += d;
      state.targetPhase = state.basePhase;
      state.lastInput = performance.now();
    };
    const step = (dir: number) => {
      const now = performance.now();
      if (now - state.lastStep < STEP_COOLDOWN_MS) return;
      state.lastStep = now;
      state.basePhase += dir;
      state.targetPhase = state.basePhase;
      state.active = false;
      state.lastInput = now;
    };

    const onPointer = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      state.pointerX = nx;
      state.pointerY = ny;
      state.active = true;
      state.lastInput = performance.now();
      const axis = state.targetOrientation > 0.5 ? ny : nx;
      state.targetPhase = state.basePhase + axis * (narrow() ? 1.4 : 2.2);
      stage.style.setProperty('--pointer-x', `${((nx + 1) / 2) * 100}%`);
      stage.style.setProperty('--pointer-y', `${((ny + 1) / 2) * 100}%`);
    };
    const onLeave = () => {
      state.active = false;
      state.targetPhase = state.basePhase;
      stage.style.setProperty('--pointer-x', '50%');
      stage.style.setProperty('--pointer-y', '50%');
    };
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 4) return;
      e.preventDefault();
      step(Math.sign(delta));
    };
    const onKey = (e: KeyboardEvent) => {
      if (!stage.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        state.lastStep = 0;
        step(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        state.lastStep = 0;
        step(-1);
      }
    };
    const clickHandlers = cards.map((card, index) => {
      const h = () => {
        if (index === nearest() && Math.abs(state.phase - Math.round(state.phase)) < 0.35) openRef.current(deck[index].c);
        else select(index);
      };
      card.addEventListener('click', h);
      return h;
    });

    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerdown', onPointer);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(() => {
      state.targetOrientation = narrow() ? 1 : 0;
    });
    ro.observe(stage);

    let prev = performance.now();
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(stage);

    const render = (time: number) => {
      raf = requestAnimationFrame(render);
      if (!visible) {
        prev = time;
        return;
      }
      const dt = Math.min(32, time - prev);
      prev = time;
      const ease = reduced ? 1 : 1 - Math.pow(0.0007, dt / 1000);

      // Idle: a slow, gentle drift so the wave is never frozen.
      if (!state.active && time - state.lastInput > 4200) {
        const idle = time - state.lastInput - 4200;
        state.targetPhase = state.basePhase + Math.sin(idle * 0.00026) * 1.4;
      }
      state.phase += (state.targetPhase - state.phase) * ease * 0.8;
      state.orientation += (state.targetOrientation - state.orientation) * ease * 0.72;
      state.tiltX += ((state.active ? state.pointerX : 0) - state.tiltX) * ease * 0.72;
      state.tiltY += ((state.active ? state.pointerY : 0) - state.tiltY) * ease * 0.72;

      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const hs = Math.min(150, Math.max(102, w * 0.11));
      const vs = Math.min(136, Math.max(99, h * 0.2));
      const activeIndex = nearest();

      cards.forEach((card, index) => {
        const delta = wrappedDelta(index, state.phase);
        const distance = Math.abs(delta);
        const focus = Math.exp(-Math.pow(distance, 2) * 1.05);
        const side = Math.max(0, 1 - distance / 5);
        const direction = Math.sign(delta);
        const hx = delta * hs;
        const hy = -Math.pow(distance, 1.45) * 6 + Math.sin(delta * 0.8) * 5;
        const vx = Math.sin(delta * 0.82) * Math.min(78, w * 0.06) + direction * Math.pow(distance, 1.25) * 8;
        const vy = delta * vs;
        const x = hx * (1 - state.orientation) + vx * state.orientation;
        const y = hy * (1 - state.orientation) + vy * state.orientation;
        const z = focus * 140 - distance * 78;
        // the case in front bulges forward, clearly bigger than its neighbours
        const scale = 0.55 + side * 0.14 + Math.pow(focus, 2.2) * 0.62;
        const rx = -state.tiltY * focus * 5 + delta * 2.2 * state.orientation;
        const ry = state.tiltX * focus * 7 - delta * 8.5 * (1 - state.orientation);
        const rz = delta * 2.25 * (1 - state.orientation) - delta * 1.4 * state.orientation;
        card.style.setProperty('--focus', focus.toFixed(4));
        card.style.zIndex = String(Math.round(1000 - distance * 100));
        card.style.opacity = String(Math.max(0.14, side * 0.82 + focus * 0.18));
        card.style.filter = `blur(${Math.max(0, distance - 1.35) * 0.45}px) saturate(${0.72 + focus * 0.28})`;
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        card.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      });
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      cards.forEach((card, i) => card.removeEventListener('click', clickHandlers[i]));
      stage.removeEventListener('pointermove', onPointer);
      stage.removeEventListener('pointerdown', onPointer);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [deck]);

  if (deck.length === 0) return null;
  const waiting = cases.filter((c) => c.status === 'pending_review').length;

  return (
    <section className="case-wave" aria-label="Review cases">
      <div className="case-wave-head">
        <div>
          <p className="case-wave-kicker">Merges to be reviewed</p>
          <p className="case-wave-title">{waiting ? `${waiting} case${waiting === 1 ? '' : 's'} waiting` : 'All cases settled'}</p>
        </div>
        <p className="case-wave-help">Move across the cards · scroll to step · pick the front card to open it</p>
      </div>
      <div className="case-wave-stage" ref={stageRef}>
        <div className="case-wave-deck">
          {deck.map(({ c, key, echo }, i) => (
            <button
              key={key}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              type="button"
              className="case-wave-card"
              style={{ ['--card-color' as string]: CARD_COLORS[i % CARD_COLORS.length] }}
              aria-label={`${c.status === 'pending_review' ? 'Review' : 'Settled'}: ${c.patientName}, ${c.label}, ${dose(c, 'current')} versus ${dose(c, 'incoming')}`}
              tabIndex={echo ? -1 : 0}
            >
              <span className="case-wave-face">
                <span className="case-wave-chip">{c.status === 'pending_review' ? 'Review' : 'Settled'}</span>
                <span className="case-wave-initials">{initialsOf(c.patientName)}</span>
                <span className="case-wave-dose">
                  <b>{dose(c, 'current')}</b>
                  <i>vs</i>
                  <b>{dose(c, 'incoming')}</b>
                </span>
              </span>
              <span className="case-wave-identity">
                <span className="case-wave-name">{c.patientName}</span>
                <span className="case-wave-role">
                  {c.label} · {relativeTime(c.createdAt)}
                </span>
                <span className="case-wave-open" aria-hidden="true">Open case</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

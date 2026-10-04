/**
 * CaseRing — the review cases as a slowly turning 3D ring of tiles, in the
 * ID-card palette. Scrolling the page spins it faster (the spin eases back
 * down afterwards). Pick a tile, or a chip in the dock, to bring that case to
 * the front and jump to it in the list below. Resolved cases fill out the ring
 * in a quieter style so it never looks empty.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conflict } from '@shared/types';
import { relativeTime } from '../../components/ui';
import './caseRing.css';

const BASE_SPEED = 9; // deg per second
const MAX_SPEED = 320;
const MIN_TILES = 10;

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

function describe(c: Conflict, side: 'current' | 'incoming') {
  const v = side === 'current' ? c.currentValue : c.incomingValue;
  return v.active ? v.dosage || '—' : 'Stopped';
}

interface Tile {
  key: string;
  conflict: Conflict;
  pending: boolean;
}

export function CaseRing({ pending, resolved, onSelect }: { pending: Conflict[]; resolved: Conflict[]; onSelect: (c: Conflict) => void }) {
  const tiles: Tile[] = useMemo(() => {
    const list: Tile[] = pending.map((c) => ({ key: `p-${c.id}`, conflict: c, pending: true }));
    for (const c of resolved) {
      if (list.length >= Math.max(MIN_TILES, pending.length)) break;
      list.push({ key: `r-${c.id}`, conflict: c, pending: false });
    }
    // Still short (a fresh system): repeat what we have so the ring closes.
    const base = [...list];
    let i = 0;
    while (list.length > 0 && list.length < MIN_TILES) {
      const t = base[i % base.length];
      list.push({ ...t, key: `${t.key}-echo-${i}` });
      i++;
    }
    return list;
  }, [pending, resolved]);

  const ringRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const speed = useRef(BASE_SPEED);
  const targetAngle = useRef<number | null>(null);
  const [speedView, setSpeedView] = useState(BASE_SPEED);
  const n = tiles.length;
  const step = n ? 360 / n : 0;
  const radius = Math.max(260, (n * 150) / (2 * Math.PI));

  // Spin loop.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let lastShown = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (stageRef.current) io.observe(stageRef.current);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible) {
        if (targetAngle.current !== null) {
          // Ease to the selected tile, then resume spinning from there.
          const diff = targetAngle.current - angle.current;
          angle.current += diff * Math.min(1, dt * 6);
          if (Math.abs(diff) < 0.2) {
            angle.current = targetAngle.current;
            targetAngle.current = null;
            speed.current = 0;
          }
        } else if (!reduce) {
          speed.current += (BASE_SPEED - speed.current) * Math.min(1, dt * 1.4);
          angle.current -= speed.current * dt;
        }
        if (ringRef.current) ringRef.current.style.transform = `translateZ(${-radius}px) rotateX(-9deg) rotateY(${angle.current}deg)`;
        if (now - lastShown > 120) {
          lastShown = now;
          setSpeedView(Math.round(Math.abs(speed.current)));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [radius]);

  // Page scrolling (wheel, touch, keys) feeds the spin.
  useEffect(() => {
    let lastY = window.scrollY;
    const kick = (amount: number) => {
      targetAngle.current = null;
      speed.current = Math.min(MAX_SPEED, speed.current + amount);
    };
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      kick(dy * 0.9);
    };
    const onWheel = (e: WheelEvent) => kick(Math.abs(e.deltaY) * 0.35);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  const bringToFront = (index: number, c: Conflict) => {
    // Nearest rotation that puts this tile at the front.
    const want = -index * step;
    let a = want;
    while (a - angle.current > 180) a -= 360;
    while (a - angle.current < -180) a += 360;
    targetAngle.current = a;
    onSelect(c);
  };

  if (n === 0) return null;
  const pendingCount = pending.length;

  return (
    <section className="case-ring" aria-label="Review cases ring">
      <div className="case-ring-head">
        <div>
          <p className="case-ring-kicker">MERGES TO BE REVIEWED</p>
          <p className="case-ring-title">
            {pendingCount ? `${pendingCount} case${pendingCount === 1 ? '' : 's'} waiting` : 'All cases settled'}
          </p>
        </div>
        <div className="case-ring-speed" aria-hidden="true">
          <span>SPIN</span>
          <b>{speedView}</b>
          <span>°/S</span>
        </div>
      </div>

      <div className="case-ring-stage" ref={stageRef}>
        <div className="case-ring-ring" ref={ringRef}>
          {tiles.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`case-tile ${t.pending ? 'is-pending' : 'is-settled'} ${i % 2 ? 'tier-low' : 'tier-high'}`}
              style={{ transform: `rotateY(${i * step}deg) translateZ(${radius}px) translateY(${i % 2 ? 34 : -34}px)` }}
              onClick={() => bringToFront(i, t.conflict)}
              aria-label={`${t.pending ? 'Review' : 'Resolved'}: ${t.conflict.patientName}, ${t.conflict.label}`}
              tabIndex={t.key.includes('-echo-') ? -1 : 0}
            >
              <span className="case-tile-face">
                <span className="case-tile-top">
                  <span className="case-tile-chip">{t.pending ? 'REVIEW' : 'SETTLED'}</span>
                  <span className="case-tile-time">{relativeTime(t.conflict.createdAt)}</span>
                </span>
                <span className="case-tile-initials">{initialsOf(t.conflict.patientName)}</span>
                <span className="case-tile-name">{t.conflict.patientName}</span>
                <span className="case-tile-med">{t.conflict.label}</span>
                <span className="case-tile-vs">
                  <b>{describe(t.conflict, 'current')}</b>
                  <i>vs</i>
                  <b>{describe(t.conflict, 'incoming')}</b>
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="case-ring-floor" aria-hidden="true" />
      </div>

      <div className="case-ring-dock" role="list" aria-label="Jump to a case">
        {tiles
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => !t.key.includes('-echo-'))
          .map(({ t, i }) => (
            <button
              key={t.key}
              type="button"
              role="listitem"
              className={`case-dock-chip ${t.pending ? 'is-pending' : ''}`}
              onClick={() => bringToFront(i, t.conflict)}
              title={`${t.conflict.patientName} · ${t.conflict.label}`}
            >
              {initialsOf(t.conflict.patientName)}
            </button>
          ))}
      </div>
      <p className="case-ring-hint">Scroll to spin faster · pick a tile to open the case</p>
    </section>
  );
}

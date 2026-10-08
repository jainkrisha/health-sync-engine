/**
 * NavWheel — desktop navigation as a fan of cards pivoting off the left edge.
 * Touch the left edge (or focus the MENU tab) and the fan opens; scroll to turn
 * it between destinations; click a card, or press Enter, to go there. Each card
 * carries the menu name and one line about what is behind it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import { Icon, type IconName } from '../components/Icon';
import './navWheel.css';

export interface WheelItem {
  to: string;
  label: string;
  line: string;
  icon: IconName;
  color: string;
  count?: number;
}

const STEP_DEG = 23;
const STEP_COOLDOWN_MS = 130;

export function NavWheel({ items }: { items: WheelItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const closeTimer = useRef(0);
  const lastStep = useRef(0);
  const acc = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentIndex = Math.max(
    0,
    items.findIndex((i) => location.pathname === i.to || (i.to !== '/patients/new' && location.pathname.startsWith(i.to + '/')) || location.pathname === i.to),
  );

  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const show = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    if (!openRef.current) setActive(currentIndex);
    openRef.current = true;
    setOpen(true);
  }, [currentIndex]);
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 280);
  };
  const go = (i: number) => {
    setOpen(false);
    navigate(items[i].to);
  };

  // Touching the left edge of the window opens the wheel.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (e.clientX <= 14 && e.clientY > 64) show();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [show]);

  // Scroll turns the wheel; keys work too while it is open.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const step = (dir: number) => {
      const now = performance.now();
      if (now - lastStep.current < STEP_COOLDOWN_MS) return;
      lastStep.current = now;
      setActive((a) => Math.min(items.length - 1, Math.max(0, a + dir)));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc.current += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(acc.current) >= 40) {
        step(Math.sign(acc.current));
        acc.current = 0;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        lastStep.current = 0;
        step(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        lastStep.current = 0;
        step(-1);
      }
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKey);
    return () => {
      panel.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, items.length]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const current = items[currentIndex];

  return (
    <>
      {/* the edge: a thin hot zone and a visible MENU tab */}
      <button
        type="button"
        className={`nav-wheel-tab ${open ? 'is-hidden' : ''}`}
        onPointerEnter={show}
        onFocus={show}
        onClick={show}
        aria-label={t('Open the menu')}
        aria-expanded={open}
      >
        <Icon name={current?.icon ?? 'menu'} className="h-4 w-4" />
        <span>{t('MENU')}</span>
      </button>

      <div className={`nav-wheel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="nav-wheel-backdrop" onClick={() => setOpen(false)} />
        <nav
          ref={panelRef}
          className="nav-wheel-panel"
          aria-label={t('Main navigation')}
          onPointerEnter={() => window.clearTimeout(closeTimer.current)}
          onPointerLeave={hideSoon}
        >
          <div className="nav-wheel-pivot">
            {items.map((item, i) => {
              const offset = i - active;
              const angle = open ? offset * STEP_DEG : -125 + i * 4;
              const distance = Math.abs(offset);
              const isActive = i === active;
              return (
                <a
                  key={item.to}
                  href={item.to}
                  aria-label={item.label}
                  aria-current={i === currentIndex ? 'page' : undefined}
                  tabIndex={open ? 0 : -1}
                  className={`nav-wheel-card ${isActive ? 'is-active' : ''}`}
                  style={{
                    ['--card' as string]: item.color,
                    transform: `rotate(${angle}deg) translateX(var(--radius)) scale(${isActive && open ? 1.06 : 1 - Math.min(distance, 4) * 0.04})`,
                    opacity: open ? Math.max(0.12, 1 - distance * 0.2) : 0,
                    zIndex: 100 - distance,
                    transitionDelay: open ? `${distance * 35}ms` : `${(items.length - i) * 18}ms`,
                    visibility: open ? 'visible' : 'hidden',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    go(i);
                  }}
                  onFocus={() => setActive(i)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), go(i))}
                >
                  <span className="nav-wheel-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="nav-wheel-icon">
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="nav-wheel-text">
                    <span className="nav-wheel-label">
                      {item.label}
                      {!!item.count && <span className="nav-wheel-count">{item.count}</span>}
                    </span>
                    <span className="nav-wheel-line">{item.line}</span>
                  </span>
                  <span className="nav-wheel-go" aria-hidden="true">
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </span>
                </a>
              );
            })}
          </div>
          <p className="nav-wheel-hint">{t('Scroll to turn · click to open · Esc to close')}</p>
        </nav>
      </div>
    </>
  );
}

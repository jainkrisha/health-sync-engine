/**
 * ParticleTitle — the app name drawn as thousands of glowing grains.
 * The grains gather into the word on load; the pointer blows them away like
 * sparks (they warm to orange as they scatter) and they drift back into place.
 */
import { useEffect, useRef } from 'react';

interface Grain {
  x: number;
  y: number;
  hx: number; // home
  hy: number;
  vx: number;
  vy: number;
  heat: number; // 0..1, how disturbed (drives colour)
  size: number;
  tw: number; // twinkle phase
}

export function ParticleTitle({ text = 'HealthSync.', className = '' }: { text?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let grains: Grain[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    const pointer = { x: -9999, y: -9999, active: false };

    const build = async () => {
      // Make sure the display font is ready before sampling glyph pixels.
      try {
        await document.fonts.load('700 120px Geist');
      } catch {
        /* fall back to whatever is available */
      }
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the word off-screen and sample its pixels.
      const off = document.createElement('canvas');
      off.width = Math.round(w);
      off.height = Math.round(h);
      const o = off.getContext('2d');
      if (!o) return;
      let size = h * 0.78;
      o.font = `700 ${size}px Geist, Inter, system-ui, sans-serif`;
      const measured = o.measureText(text).width;
      if (measured > w * 0.94) size *= (w * 0.94) / measured;
      o.font = `700 ${size}px Geist, Inter, system-ui, sans-serif`;
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillStyle = '#fff';
      o.letterSpacing = `${-size * 0.035}px`;
      o.fillText(text, w / 2, h / 2 + size * 0.04);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(1.6, size / 64);
      const next: Grain[] = [];
      for (let fy = 0; fy < off.height; fy += step) {
        for (let fx = 0; fx < off.width; fx += step) {
          const x = Math.round(fx);
          const y = Math.round(fy);
          if (data[(y * off.width + x) * 4 + 3] > 140) {
            const jx = x + (Math.random() - 0.5) * step;
            const jy = y + (Math.random() - 0.5) * step;
            next.push({
              hx: jx,
              hy: jy,
              x: reduce ? jx : Math.random() * w,
              y: reduce ? jy : h + Math.random() * h * 0.6,
              vx: 0,
              vy: 0,
              heat: reduce ? 0 : 1,
              size: 1 + Math.random() * 1.1,
              tw: Math.random() * Math.PI * 2,
            });
          }
        }
      }
      grains = next;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const R = Math.max(40, h * 0.42);
      for (const g of grains) {
        if (!reduce) {
          // Pointer pushes grains away.
          if (pointer.active) {
            const dx = g.x - pointer.x;
            const dy = g.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < R * R) {
              const d = Math.sqrt(d2) || 1;
              const f = (1 - d / R) * 3.2;
              g.vx += (dx / d) * f + (Math.random() - 0.3) * 0.8;
              g.vy += (dy / d) * f + Math.random() * 0.9;
              g.heat = Math.min(1, g.heat + 0.25);
            }
          }
          // Spring back home.
          g.vx += (g.hx - g.x) * 0.018;
          g.vy += (g.hy - g.y) * 0.018;
          g.vx *= 0.88;
          g.vy *= 0.88;
          g.x += g.vx;
          g.y += g.vy;
          g.heat *= 0.965;
        }
        const tw = 0.75 + 0.25 * Math.sin(t * 0.004 + g.tw);
        // Cream at rest, burnt orange when disturbed.
        const r = 236 + (240 - 236) * g.heat;
        const gg = 231 + (140 - 231) * g.heat;
        const b = 218 + (80 - 218) * g.heat;
        ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${0.7 * tw + 0.25 * g.heat})`;
        ctx.fillRect(g.x, g.y, g.size, g.size);
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = pointer.x > -40 && pointer.x < r.width + 40 && pointer.y > -40 && pointer.y < r.height + 40;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => void build(), 150);
    };

    void build().then(() => {
      raf = requestAnimationFrame(draw);
    });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [text]);

  return (
    <h1 className={className}>
      <span className="sr-only">{text}</span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-full w-full"
        style={{ filter: 'drop-shadow(0 0 6px rgba(240, 190, 140, 0.35)) drop-shadow(0 0 18px rgba(224, 102, 58, 0.18))' }}
      />
    </h1>
  );
}

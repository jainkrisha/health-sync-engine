/**
 * LiquidMetal — live sign-in background: chrome droplets drifting and slowly
 * changing shape, like liquid metal. Pure CSS transforms (GPU friendly), no
 * video or canvas, so it costs almost nothing on low-end PHC devices.
 */
import type { CSSProperties } from 'react';

interface Blob {
  size: number; // px
  x: number; // vw
  y: number; // vh
  dur: number; // drift seconds
  morph: number; // shape seconds
  delay: number;
  path: 1 | 2 | 3;
  blur?: number;
}

const BLOBS: Blob[] = [
  { size: 260, x: -4, y: 6, dur: 26, morph: 9, delay: -4, path: 1 },
  { size: 120, x: 22, y: 64, dur: 21, morph: 7, delay: -11, path: 2 },
  { size: 72, x: 36, y: 14, dur: 18, morph: 6, delay: -2, path: 3 },
  { size: 340, x: 74, y: 52, dur: 30, morph: 11, delay: -15, path: 2 },
  { size: 96, x: 84, y: 10, dur: 19, morph: 6, delay: -7, path: 1 },
  { size: 54, x: 58, y: 80, dur: 16, morph: 5, delay: -9, path: 3 },
  { size: 180, x: 8, y: 78, dur: 24, morph: 8, delay: -18, path: 3, blur: 2 },
  { size: 40, x: 50, y: 4, dur: 15, morph: 5, delay: -5, path: 2 },
  { size: 150, x: 92, y: 86, dur: 27, morph: 9, delay: -20, path: 1, blur: 1.5 },
];

export function LiquidMetal() {
  return (
    <div className="liquid-metal" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className={`lm-drift lm-path-${b.path}`}
          style={
            {
              left: `${b.x}vw`,
              top: `${b.y}vh`,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
            } as CSSProperties
          }
        >
          <span
            className="lm-drop"
            style={
              {
                width: b.size,
                height: b.size,
                animationDuration: `${b.morph}s`,
                animationDelay: `${b.delay}s`,
                filter: b.blur ? `blur(${b.blur}px)` : undefined,
              } as CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}

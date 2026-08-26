"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoMark from "./LogoMark";

const ITEMS = [
  { label: "HOME", href: "/" },
  { label: "ROOMS", href: "/accommodation" },
  { label: "BREAKFAST", href: "/breakfast" },
  { label: "AMENITIES", href: "/amenities" },
  { label: "GALLERY", href: "/gallery" },
  { label: "CONTACT", href: "/contact" },
] as const;

/* Dial geometry, in viewBox units. The fan opens from 9 o'clock (180deg)
   clockwise past 12, so it sweeps up and left out of the bottom-right corner. */
const C = 260;
const R_ARC = 132;
const R_LABEL = 154;
const SWEEP_FROM = 180;
const SLOT = 18.5;
/* Butt caps, not round: at this stroke width round caps swallow the gaps and
   the six segments read as one band. Softness comes from the shadow filter. */
const GAP = 3.5;

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
};

const arcPath = (from: number, to: number, r: number) => {
  const a = polar(from, r);
  const b = polar(to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const segments = ITEMS.map((item, i) => {
  const from = SWEEP_FROM + i * SLOT + GAP / 2;
  const to = from + SLOT - GAP;
  return { ...item, from, to, mid: (from + to) / 2 };
});

export default function DialNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeIndex = segments.findIndex((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)
  );

  return (
    <div className="dial-layer">
      <div
        className="dial-anchor"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <svg className="dial-svg" viewBox="0 0 520 520" aria-hidden="true">
          <defs>
            {/* one raised light source: white up-left, green shadow down-right */}
            <filter id="nuRaise" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="5" dy="5" stdDeviation="6" floodColor="#344E41" floodOpacity="0.3" />
              <feDropShadow dx="-5" dy="-5" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.95" />
            </filter>
            {/* groove: dark edge up-left, light edge down-right — reads recessed */}
            <linearGradient id="nuTrack" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="400" y2="400">
              <stop offset="0" stopColor="#c6c3b9" />
              <stop offset="1" stopColor="#f8f6f1" />
            </linearGradient>
            <linearGradient id="nuIdle" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="400" y2="400">
              <stop offset="0" stopColor="#b4b9a3" />
              <stop offset="1" stopColor="#878d74" />
            </linearGradient>
            <linearGradient id="nuActive" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="400" y2="400">
              <stop offset="0" stopColor="#4a6b58" />
              <stop offset="1" stopColor="#28382f" />
            </linearGradient>
            {/* veils page content under the open dial so labels stay legible */}
            <radialGradient id="nuVeil">
              <stop offset="0.55" stopColor="#e4e2dc" stopOpacity="0.97" />
              <stop offset="0.8" stopColor="#e4e2dc" stopOpacity="0.82" />
              <stop offset="1" stopColor="#e4e2dc" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle
            cx={C}
            cy={C}
            r={244}
            fill="url(#nuVeil)"
            className="dial-labels"
            opacity={open ? 1 : 0}
          />

          <g
            className="dial-ring"
            style={{ transform: `scale(${open ? 1 : 0.62})` }}
            strokeWidth={open ? 24 : 15}
          >
            {/* recessed track the segments sit in */}
            <path
              d={arcPath(SWEEP_FROM - 2, SWEEP_FROM + ITEMS.length * SLOT + 2, R_ARC)}
              fill="none"
              stroke="url(#nuTrack)"
              strokeWidth={open ? 36 : 23}
              strokeLinecap="round"
              className="dial-arc"
              opacity={open ? 1 : 0.7}
            />
            <g filter="url(#nuRaise)">
              {segments.map((s, i) => (
                <path
                  key={s.href}
                  className="dial-arc"
                  d={arcPath(s.from, s.to, R_ARC)}
                  fill="none"
                  stroke={i === activeIndex ? "url(#nuActive)" : "url(#nuIdle)"}
                  strokeLinecap="butt"
                />
              ))}
            </g>

            <g className="dial-labels" opacity={open ? 1 : 0}>
              {segments.map((s, i) => {
                const p = polar(s.mid, R_LABEL);
                const flip = s.mid > 90 && s.mid < 270;
                return (
                  <text
                    key={s.href}
                    x={p.x}
                    y={p.y}
                    transform={`rotate(${s.mid + (flip ? 180 : 0)} ${p.x} ${p.y})`}
                    textAnchor={flip ? "end" : "start"}
                    dominantBaseline="middle"
                    fill={i === activeIndex ? "#344E41" : "#6B705C"}
                    style={{
                      font: `${i === activeIndex ? 700 : 500} 12px var(--font-mono), ui-monospace, monospace`,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {s.label}
                  </text>
                );
              })}
            </g>
          </g>
        </svg>

        <nav aria-label="Main">
          {segments.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="dial-spoke"
              aria-current={i === activeIndex ? "page" : undefined}
              tabIndex={open ? 0 : -1}
              style={{
                transform: `rotate(${s.mid}deg) translate(56px, -20px)`,
                pointerEvents: open ? "auto" : "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clipPath: "inset(50%)",
                }}
              >
                {s.label}
              </span>
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="dial-puck"
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((v) => !v)}
        >
          <LogoMark size={36} />
        </button>
      </div>
    </div>
  );
}

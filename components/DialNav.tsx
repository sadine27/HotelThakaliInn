"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import LogoMark from "./LogoMark";

const ITEMS = [
  { label: "HOME", href: "/" },
  { label: "ROOMS", href: "/rooms" },
  { label: "BREAKFAST", href: "/breakfast" },
  { label: "AMENITIES", href: "/amenities" },
  { label: "GALLERY", href: "/gallery" },
  { label: "CONTACT", href: "/contact" },
] as const;

/* Dial geometry, in viewBox units. The fan opens from 9 o'clock (180deg)
   clockwise past 12, so it sweeps up and left out of the bottom-right corner. */
const C = 260;
const R_ARC = 128;
const R_LABEL = 150;
const SWEEP_FROM = 180;
const SLOT = 18.5;
/* Butt caps, not round: at this stroke width round caps swallow the gaps and
   the six segments read as one band. Softness comes from the shadow filter. */
const GAP = 3.5;

/* Both palettes live in globals.css and switch on [data-dial-open], because the
   dial's ground changes underneath it: closed it lies on the cream card, open it
   lies on the well's dark floor. Referencing them as vars means the existing
   stroke/fill transitions cross-fade the two sets as the well opens. */
const TRACK = "var(--dial-track)";
const IDLE = "var(--dial-idle)";
const HOVER = "var(--dial-hover)";
const ACTIVE = "var(--dial-active)";

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
  const [hovered, setHovered] = useState(-1);
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();

  /* The dial drives the page transition. A plain left-click is wrapped in a
     View Transition (the dial itself is lifted out of the snapshot by
     view-transition-name in globals.css, so it stays put); every other gesture
     falls through to the plain <Link>, which already works. */
  function go(event: React.MouseEvent<HTMLAnchorElement | SVGGElement>, href: string) {
    /* A middle-click or cmd-click means "new tab" — preventDefault on those is
       the classic way a fancy nav breaks a habit people rely on. */
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    /* No API, or the visitor asked for less motion: the transition is an
       enhancement on a navigation that must never depend on it. */
    if (reduced || !document.startViewTransition) return;
    event.preventDefault();
    document.startViewTransition(() => router.push(href));
  }

  /* Only clicks in the OPEN dial's band count. Collapsed, the band sits at
     r≈95 viewBox units (scale .74), so a fast click on it would land here
     mid-animation and navigate from a spoke the visitor never saw. The open
     arc lives at r≈128 and the labels at r≈150 — this window covers both,
     not the collapsed band, not the well floor.

     Measured in viewBox units, not screen px: the anchor scales to 0.62 on
     small screens, and a screen-px window would put every spoke outside its
     own bounds there — the dial opened but nothing was clickable. */
  function inOpenBand(event: React.MouseEvent<SVGGElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return false;
    const box = svg.getBoundingClientRect();
    const d = Math.hypot(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2)) / (box.width / 520);
    return d > 106 && d < 168;
  }

  /* The well is cut by the page, not by this component, so the page has to know
     when the dial wants room. A collapsed puck sitting in a full-size well is a
     dark blot on the card — the hole has to open with the fan. */
  useEffect(() => {
    const el = document.documentElement;
    if (open) el.dataset.dialOpen = "";
    else delete el.dataset.dialOpen;
  }, [open]);

  const activeIndex = segments.findIndex((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)
  );

  /* Not on the staff admin. It is mounted in the root layout so every guest route
     gets the same dial and it survives client-side navigation — but the admin is a
     tool, and six links to guest pages is the wrong furniture in it. Hooks run
     first so the order is stable across the boundary. */
  if (pathname.startsWith("/admin")) return null;

  return (
    <div className="dial-layer">
      <div
        className="dial-anchor"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          setOpen(false);
          setHovered(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setHovered(-1);
          }
        }}
      >
        {/* Continuous hit field. The puck ends at r=38 and the spokes start at
            r=52, so without this the pointer crosses dead space on its way to
            an arc and mouseleave collapses the dial before you arrive. */}
        <div
          className="dial-field"
          style={{ pointerEvents: open ? "auto" : "none" }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <svg
          className="dial-svg"
          viewBox="0 0 520 520"
          aria-hidden="true"
          /* The arcs are not focusable, so clicking one would by default move
             focus from the puck to <body> — and the anchor's onBlur reads that
             as "focus left" and closes the dial underneath the click. Suppress
             the mousedown focus change: the click still fires, focus stays
             where it was, and blur keeps its real job (Tab out = close). */
          onMouseDown={(e) => e.preventDefault()}
        >
          <defs>
            {/* set through style, not attributes, so the vars resolve and the
                shadow deepens with the palette as the well opens under it */}
            {/* userSpaceOnUse, not the default objectBoundingBox: a percentage
                region is a percentage of the PATH's box, which ignores stroke
                width. GALLERY's arc is 3.9 units tall and wears a 14-unit
                stroke, so a 180% region clipped most of the paint off it —
                six identical 15deg arcs rendering at six different sizes. One
                fixed region over the whole viewBox, shared by all six. */}
            <filter
              id="nuMatteShadow"
              filterUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="520"
              height="520"
            >
              <feDropShadow
                dx="3"
                dy="4"
                stdDeviation="7"
                style={{ floodColor: "var(--dial-shadow)", floodOpacity: "var(--dial-shadow-a)" }}
              />
            </filter>
          </defs>

          <g
            className="dial-ring"
            style={{ transform: `scale(${open ? 1 : 0.74})` }}
            strokeWidth={open ? 14 : 9}
          >
            {/* recessed track the segments sit in */}
            <path
              d={arcPath(SWEEP_FROM - 2, SWEEP_FROM + ITEMS.length * SLOT + 2, R_ARC)}
              fill="none"
              stroke={TRACK}
              strokeWidth={open ? 22 : 14}
              strokeLinecap="round"
              className="dial-arc"
              opacity={open ? 1 : 0.7}
            />
            {segments.map((s, i) => {
              const p = polar(s.mid, R_LABEL);
              const flip = s.mid > 90 && s.mid < 270;
              return (
                /* One hit target per segment: the visible arc and its label. The
                   gap between segments is dead, so a click that misses a spoke
                   can never fire its neighbour — the old 42px pills tiled the
                   whole slot edge-to-edge and a near-miss on HOME landed on
                   ROOMS. The filter moves to the path so the labels stay
                   unshadowed, as before. */
                <g
                  key={s.href}
                  className="dial-seg"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(-1)}
                  onClick={(e) => {
                    if (open && inOpenBand(e)) go(e, s.href);
                  }}
                >
                  <path
                    className="dial-arc"
                    d={arcPath(s.from, s.to, R_ARC)}
                    fill="none"
                    stroke={i === activeIndex ? ACTIVE : i === hovered ? HOVER : IDLE}
                    strokeLinecap="butt"
                    filter="url(#nuMatteShadow)"
                  />
                  <text
                    x={p.x}
                    y={p.y}
                    transform={`rotate(${s.mid + (flip ? 180 : 0)} ${p.x} ${p.y})`}
                    textAnchor={flip ? "end" : "start"}
                    dominantBaseline="middle"
                    opacity={open ? 1 : 0}
                    fill={i === activeIndex || i === hovered ? "var(--dial-label-on)" : "var(--dial-label)"}
                    style={{
                      font: `${i === activeIndex ? 700 : 500} 10.5px var(--font-mono), ui-monospace, monospace`,
                      letterSpacing: "0.14em",
                      transition: "fill .25s ease, opacity .32s ease",
                    }}
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <nav aria-label="Main">
          {segments.map((s, i) => (
            /* The keyboard route. Pointer events are off (CSS) — the mouse
               target is the segment's arc + label above — so this link only
               fires for a real Enter on a focused spoke. */
            <Link
              key={s.href}
              href={s.href}
              className="dial-spoke"
              aria-current={i === activeIndex ? "page" : undefined}
              tabIndex={open ? 0 : -1}
              onFocus={() => setHovered(i)}
              onClick={(e) => go(e, s.href)}
              style={{
                transform: `rotate(${s.mid}deg) translate(52px, -21px)`,
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
          aria-label="Open navigation"
          /* Opens, never toggles: hover has already opened the dial by the time
             a desktop click lands, so a toggle closes it in the user's hand —
             and on touch the tap's hover-sim has the same effect. Tapping the
             empty floor closes it instead. */
          onClick={() => setOpen(true)}
        >
          <LogoMark size={38} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useLive } from "@/components/Live";

/* Rain on glass — droplets on a window, not a particle system.
 *
 * The old CSS stripes read as a technical grid because repeating gradients are
 * uniform by construction ("solar panel"). Water on a pane is the opposite:
 * irregularly scattered droplets, most sitting still, a few sliding down with
 * a wet tail, and rare distant lightning. One continuous sheet of glass —
 * nothing tiled, nothing repeating.
 *
 * Refraction: a true lens would have to sample the composited page, and the
 * brief caps it at "extremely subtle" — at 0.5–3px the cue that actually
 * reads is a soft dark crescent under a faint top-light catch, which is what
 * the gradients draw. No outlines, no bright stickers.
 *
 * Weather gates intensity: clear skies get light condensation (the glass is
 * the site's window), rain/storm add streaks, faster movers and lightning
 * every 20–60s. Reduced motion gets one static frame and no loop.
 *
 * ponytail: single canvas, no offscreen layers, O(n²) merge check is fine at
 * ≤110 drops; add spatial hashing only if the droplet budget ever rises.
 */

type Drop = {
  x: number; // px
  y: number; // px
  r: number; // px radius
  a: number; // body alpha
  hl: number; // highlight strength 0..1
  squash: number; // ellipse squash, 0.82..1
  slide: number; // px/frame downward drift (0 = sitter)
  pause: number; // frames left to hold still while sliding
  trail: boolean;
};

type Streak = { x: number; y: number; len: number; w: number; v: number; a: number; tilt: number };

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* Lightning curve: t (0..1) → overlay alpha. Two peaks, the shape of a real
   flash — the second one lands after the eye has already looked away. */
const FLASH: [number, number][] = [
  [0, 0],
  [0.12, 0.05],
  [0.2, 0.13],
  [0.3, 0.03],
  [0.42, 0.1],
  [0.62, 0.02],
  [1, 0],
];

const flashAlpha = (t: number) => {
  for (let i = 1; i < FLASH.length; i++) {
    if (t <= FLASH[i][0]) {
      const [t0, a0] = FLASH[i - 1];
      const [t1, a1] = FLASH[i];
      return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0);
    }
  }
  return 0;
};

function makeDrop(w: number, h: number, moving: boolean): Drop {
  /* size mix: most pinheads, some beads, a few fat ones — the "large droplet"
     tier is what carries the trails and the lens shadow */
  const big = Math.random();
  const r = big < 0.62 ? rand(0.4, 1.1) : big < 0.9 ? rand(1.1, 2) : rand(2, 3.4);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r,
    a: rand(0.05, 0.09 + r * 0.03),
    hl: rand(0.25, 1),
    squash: rand(0.82, 1),
    slide: moving ? rand(0.15, 0.55) : 0,
    pause: moving ? rand(20, 90) : 0,
    trail: moving && r > 1.4,
  };
}

function drawDrop(ctx: CanvasRenderingContext2D, d: Drop, flash: number) {
  const { x, y, r } = d;
  /* a position-seeded wobble, so no two droplets are the same ellipse */
  const bob = Math.sin(y * 0.011 + x * 0.007) * 0.15;
  const rx = r * (1.06 + bob * 0.2);
  const ry = r * d.squash;
  const a = d.a * (1 + flash * 2.5);
  ctx.save();
  ctx.translate(x, y);
  /* lens shadow: a dark crescent under the body, only on beads big enough to
     plausibly bend light */
  if (r > 1.2) {
    const g = ctx.createRadialGradient(rx * 0.15, ry * 0.25, 0, rx * 0.15, ry * 0.25, r * 1.35);
    g.addColorStop(0, `rgba(3, 7, 6, ${0.15 + flash * 0.1})`);
    g.addColorStop(1, "rgba(3, 7, 6, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(rx * 0.15, ry * 0.25, r * 1.35, 0, TAU);
    ctx.fill();
  }
  /* body: mostly-invisible water, cool grey, a breath brighter than the glass */
  ctx.fillStyle = `rgba(196, 210, 205, ${a})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();
  /* top-left light catch — the one cue that says "wet" */
  ctx.fillStyle = `rgba(226, 236, 232, ${(0.05 + d.hl * 0.16) * (1 + flash * 2)})`;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.3, -ry * 0.32, rx * 0.34, ry * 0.26, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, d: Drop) {
  /* a short tapered wet tail behind a mover — fades out over its own length */
  const len = Math.min(26, d.slide * 42);
  const g = ctx.createLinearGradient(d.x, d.y - len, d.x, d.y);
  g.addColorStop(0, "rgba(180, 196, 190, 0)");
  g.addColorStop(1, `rgba(180, 196, 190, ${0.04 + d.r * 0.014})`);
  ctx.strokeStyle = g;
  ctx.lineWidth = d.r * 0.7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - len);
  ctx.lineTo(d.x, d.y);
  ctx.stroke();
}

function makeStreak(w: number, h: number): Streak {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    len: rand(7, 26),
    w: rand(0.6, 1.2),
    v: rand(3.2, 6.5),
    a: rand(0.04, 0.12),
    tilt: rand(-0.08, 0.08),
  };
}

export default function RainGlass() {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useLive();
  const mood = useRef(live?.skyKey ?? "clear");

  useEffect(() => {
    mood.current = live?.skyKey ?? "clear";
  }, [live]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let drops: Drop[] = [];
    let streaks: Streak[] = [];
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let flashStart = 0; // timestamp of the current flash, 0 = none
    let nextFlash = 0; // when the next one may strike
    let last = performance.now();
    let raf = 0;

    const seed = () => {
      const n = Math.round(Math.min(110, Math.max(26, (w * h) / 24000)));
      const movers = Math.round(n / 18);
      drops = [
        ...Array.from({ length: n - movers }, () => makeDrop(w, h, false)),
        ...Array.from({ length: movers }, () => makeDrop(w, h, true)),
      ];
      streaks = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) frame(performance.now());
    };

    const frame = (now: number) => {
      const dt = Math.min(40, now - last) / 16.7; // in 60fps frames
      last = now;
      const sky = mood.current;
      const raining = sky === "rain" || sky === "storm";
      const storm = sky === "storm";

      if (!reduced) {
        /* streaks exist only while it rains; the array grows/shrinks to target */
        const target = raining ? (storm ? 70 : 45) : 0;
        while (streaks.length < target) streaks.push(makeStreak(w, h));
        if (streaks.length > target) streaks.length = target;

        if (raining) {
          if (!nextFlash) nextFlash = now + rand(20000, 60000);
          if (!flashStart && now >= nextFlash) flashStart = now;
          if (flashStart && now - flashStart > 700) {
            flashStart = 0;
            nextFlash = now + rand(20000, 60000);
          }
        } else {
          flashStart = 0;
          nextFlash = 0;
        }
      }

      const flash = flashStart ? flashAlpha((now - flashStart) / 700) : 0;

      ctx.clearRect(0, 0, w, h);

      for (const s of streaks) {
        if (!reduced) {
          s.y += s.v * dt;
          if (s.y - s.len > h) {
            s.y = -rand(0, 40);
            s.x = Math.random() * w;
          }
        }
        ctx.strokeStyle = `rgba(178, 194, 188, ${s.a})`;
        ctx.lineWidth = s.w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len * s.tilt, s.y + s.len);
        ctx.stroke();
      }

      for (const d of drops) {
        if (!reduced && d.slide > 0) {
          if (d.pause > 0) {
            d.pause -= dt;
          } else {
            d.y += d.slide * dt * (raining ? 1.6 : 0.35);
            /* a mover absorbing a sitter: the sitter swells, the mover is
               recycled to the top — water runs into water */
            for (const s of drops) {
              if (s.slide > 0 || s.r > 4) continue;
              const dx = s.x - d.x;
              const dy = s.y - d.y;
              if (dx * dx + dy * dy < (s.r + d.r) * (s.r + d.r)) {
                s.r = Math.min(4, s.r + d.r * 0.6);
                s.a = Math.min(0.22, s.a + 0.05);
                d.y = -rand(0, 30);
                d.x = Math.random() * w;
                break;
              }
            }
          }
        }
        if (d.y > h + 20) {
          d.y = -rand(0, 30);
          d.x = Math.random() * w;
        }
        if (d.trail && !reduced) drawTrail(ctx, d);
        drawDrop(ctx, d, flash);
      }

      if (flash > 0.001) {
        ctx.fillStyle = `rgba(201, 215, 228, ${flash})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    /* kick the loop. Reduced motion is handled inside frame: it draws once
       and doesn't re-schedule itself. */
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="rain-glass" aria-hidden="true" />;
}

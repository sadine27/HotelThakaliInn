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
 * the site's window), rain and storm wake the beads: they slide, trail and
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
  const r = big < 0.54 ? rand(1.3, 2.7) : big < 0.86 ? rand(2.7, 5.2) : rand(5.2, 9);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r,
    a: rand(0.1, 0.15 + r * 0.012),
    hl: rand(0.25, 1),
    squash: rand(0.82, 1),
    slide: moving ? rand(0.15, 0.55) : 0,
    pause: moving ? rand(20, 90) : 0,
    trail: moving && r > 2.6,
  };
}

function drawDrop(ctx: CanvasRenderingContext2D, d: Drop, flash: number) {
  const { x, y, r } = d;
  /* a position-seeded wobble, so no two droplets are the same ellipse */
  const bob = Math.sin(y * 0.011 + x * 0.007) * 0.15;
  const rx = r * (1.06 + bob * 0.2);
  const ry = r * d.squash;
  const lit = 1 + flash * 2;
  ctx.save();
  ctx.translate(x, y);

  /* 1. the shadow the bead throws down-right onto the glass. This is the cue
        that puts the drop ON a surface rather than in the air. */
  const sh = ctx.createRadialGradient(rx * 0.22, ry * 0.3, r * 0.25, rx * 0.22, ry * 0.3, r * 1.6);
  sh.addColorStop(0, `rgba(2, 5, 4, ${0.36 + flash * 0.12})`);
  sh.addColorStop(1, "rgba(2, 5, 4, 0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(rx * 0.22, ry * 0.3, r * 1.6, 0, TAU);
  ctx.fill();

  /* 2. the water itself — brighter where the light enters, falling away to
        almost nothing at the far edge, so the bead has volume. */
  const body = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, r * 0.12, 0, 0, r * 1.05);
  body.addColorStop(0, `rgba(216, 230, 224, ${Math.min(0.85, (d.a + 0.12) * lit)})`);
  body.addColorStop(0.62, `rgba(152, 172, 166, ${d.a * 0.55 * lit})`);
  body.addColorStop(1, `rgba(120, 140, 136, ${d.a * 0.16 * lit})`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();

  /* 3. the lit rim. A bead is a lens: it gathers light and lays it down along
        the edge away from the source. Drawn as an arc, not a full ring — a
        closed ring reads as an outline, which the brief forbids. */
  ctx.strokeStyle = `rgba(228, 240, 236, ${Math.min(0.7, (0.1 + d.hl * 0.2) * lit)})`;
  ctx.lineWidth = Math.max(0.55, r * 0.15);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.9, ry * 0.9, 0, 0.42, 2.42);
  ctx.stroke();

  /* 4. the specular catch, up-left, small and bright: the one hard highlight
        the eye reads instantly as wet. */
  ctx.fillStyle = `rgba(242, 250, 247, ${Math.min(0.8, (0.16 + d.hl * 0.26) * lit)})`;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.33, -ry * 0.36, rx * 0.22, ry * 0.16, -0.5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, d: Drop) {
  /* a short tapered wet tail behind a mover — fades out over its own length */
  const len = Math.min(60, d.slide * 42 + d.r * 5);
  const g = ctx.createLinearGradient(d.x, d.y - len, d.x, d.y);
  g.addColorStop(0, "rgba(180, 196, 190, 0)");
  g.addColorStop(1, `rgba(186, 202, 196, ${Math.min(0.3, 0.07 + d.r * 0.022)})`);
  ctx.strokeStyle = g;
  ctx.lineWidth = d.r * 0.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - len);
  ctx.lineTo(d.x, d.y);
  ctx.stroke();
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
    /* Admin-controlled per daypart (rain_glass_day / rain_glass_night in
       settings), resolved server-side into this one flag by /api/live. */
    if (!live?.rainGlass) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let drops: Drop[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let flashStart = 0; // timestamp of the current flash, 0 = none
    let nextFlash = 0; // when the next one may strike
    let last = performance.now();
    let raf = 0;

    const seed = () => {
      const n = Math.round(Math.min(180, Math.max(40, (w * h) / 9000)));
      const movers = Math.round(n / 7);
      drops = [
        ...Array.from({ length: n - movers }, () => makeDrop(w, h, false)),
        ...Array.from({ length: movers }, () => makeDrop(w, h, true)),
      ];
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

      /* The glass is a rain effect, not permanent condensation: with a clear
         or merely cloudy sky it stays empty. Nothing below this line runs on a
         dry day, which also means the dry state costs one clearRect a frame. */
      if (!raining) {
        if (!reduced) raf = requestAnimationFrame(frame);
        return;
      }

      for (const d of drops) {
        if (!reduced && d.slide > 0) {
          if (d.pause > 0) {
            d.pause -= dt;
          } else {
            d.y += d.slide * dt * (storm ? 2.2 : 1.5);
            /* a mover absorbing a sitter: the sitter swells, the mover is
               recycled to the top — water runs into water */
            for (const s of drops) {
              if (s.slide > 0 || s.r > 9) continue;
              const dx = s.x - d.x;
              const dy = s.y - d.y;
              if (dx * dx + dy * dy < (s.r + d.r) * (s.r + d.r)) {
                s.r = Math.min(9.5, s.r + d.r * 0.45);
                s.a = Math.min(0.3, s.a + 0.04);
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
    /* live starts null and resolves after the first /api/live fetch, so this
       has to re-run once rainGlass flips true rather than only on mount. */
  }, [live?.rainGlass]);

  return <canvas ref={ref} className="rain-glass" aria-hidden="true" />;
}

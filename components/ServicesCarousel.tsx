"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Img from "@/components/Img";
import { motion, useMotionValue, useReducedMotion, useSpring, type Variants } from "framer-motion";
import { DRAG, SWAY } from "@/lib/carousel";

/* The cards arrive from D1 through app/page.tsx, by way of HeroCarousel. An empty
   tag simply renders no chip. */
export type ServiceCardData = {
  title: string;
  tag: string;
  description: string;
  href: string;
  image: string;
};

const DWELL = 4200;
const TILT = 6; /* deg of rotateX */

/* The ring's geometry lives in CSS (--ring-radius on .svc-carousel) so it tracks
   the responsive card size without a resize listener. All this file does is turn
   the ring and fly the cards in. */

/* Deterministic per-card noise. Math.random() would give the server and the client
   different first frames and trip a hydration mismatch. */
function noise(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* The pen's signature: each card arrives from somewhere else entirely — a random
   point, depth and tumble — and settles onto its facet. Staggered so they land as a
   scatter rather than a volley.
   Deliberately no opacity here. The reference fades its blocks in, but any opacity
   below 1 forces transform-style:flat on this element, which switches off the
   backface-visibility the cards rely on — a tumbling card would show its own front
   mirrored instead of .svc-back. The panel fades in around them anyway.

   Deliberately no y either, and x is a share of the card's own width rather than a
   pixel throw. .beyond is a scroll container, and a card thrown past its edges adds
   real scrollable overflow — a scrollbar appeared for the whole three seconds of the
   entrance. Depth and the two tumbles carry the drama; negative z only ever shrinks
   a card toward the vanishing point, so the flight now stays inside the panel. */
const flyIn: Variants = {
  packed: (i: number) => ({
    x: `${(noise(i, 1) - 0.5) * 70}%`,
    z: -2400 + noise(i, 3) * 2000,
    /* the reference tumbles on both axes; this one spins only about Y, the ring's
       own axis. A rotateX swings the card's near edge toward the camera, and the
       magnification made the panel 46px taller than it rests — a scrollbar again. */
    rotateY: 360 * (1 + Math.round(noise(i, 5))),
    transition: { duration: 0 },
  }),
  landed: (i: number) => ({
    x: "0%",
    z: 0,
    rotateY: 0,
    transition: {
      duration: 1.5 + noise(i, 6),
      delay: 0.15 + noise(i, 7) * 0.7,
      ease: [0.87, 0, 0.13, 1], /* expo in-out, like the reference's Expo.easeInOut */
    },
  }),
};

/* reduced motion: the cards are simply already there */
const still: Variants = { packed: {}, landed: {} };

function ServiceCard({ card, front }: { card: ServiceCardData; front: boolean }) {
  return (
    <Link href={card.href} className="svc-card" data-active={front || undefined} tabIndex={front ? undefined : -1}>
      <div className="svc-well">
        <Img src={card.image} alt="" fill sizes="(max-width: 820px) 90vw, 740px" className="svc-media" priority={front} />
        <div className="svc-scrim" />
      </div>
      <div className="svc-content">
        {card.tag && <span className="svc-tag">{card.tag}</span>}
        <h3>{card.title}</h3>
        <p>{card.description}</p>
        <span className="svc-cta">Explore →</span>
      </div>
    </Link>
  );
}

export default function ServicesCarousel({ open, cards }: { open: boolean; cards: ServiceCardData[] }) {
  /* Unbounded, not a modulo index: the ring should turn one facet in the direction
     you asked for, never unwind 288° the long way round when 4 wraps to 0. */
  const [turn, setTurn] = useState(0);
  const [paused, setPaused] = useState(false);
  /* 0 until measured. The ring must not server-render: framer-motion rounds its
     transforms to 3dp on the client while React's SSR prints full precision, and
     the two disagree on hydration. Nothing is lost by waiting — .beyond is hidden
     and inert until Explore is clicked. */
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();

  const total = cards.length;
  const step = 360 / total;
  const active = ((turn % total) + total) % total;

  const swayTo = useMotionValue(0);
  const tiltTo = useMotionValue(0);
  const sway = useSpring(swayTo, { stiffness: 60, damping: 18 });
  const tilt = useSpring(tiltTo, { stiffness: 60, damping: 18 });

  const dragFrom = useRef<number | null>(null);
  /* a drag that lands on the front card would otherwise fire a click on its <Link>
     and navigate; onClickCapture below eats that one click. */
  const dragged = useRef(false);

  useEffect(() => {
    const check = () => setWidth(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const mobile = width > 0 && width < 820;

  useEffect(() => {
    if (paused || mobile || reduced || !open) return;
    const t = setInterval(() => setTurn((n) => n + 1), DWELL);
    return () => clearInterval(t);
  }, [paused, mobile, reduced, open]);

  /* `step` above divides by this, so an empty ring is a NaN rotation rather than
     an empty panel. Staff can unpublish every card; they should not be able to
     take the homepage down doing it. */
  if (!total) return null;

  /* holds the deck's footprint so nothing jumps when the ring arrives */
  if (!width) {
    return (
      <div className="svc-carousel">
        <div className="svc-stage" />
      </div>
    );
  }

  if (mobile) {
    return (
      <div className="svc-mobile">
        {cards.map((c) => (
          <ServiceCard key={c.title} card={c} front />
        ))}
      </div>
    );
  }

  const lean = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    swayTo.set(((e.clientX - r.left) / r.width - 0.5) * 2 * SWAY);
    tiltTo.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * TILT);
  };

  const level = () => {
    swayTo.set(0);
    tiltTo.set(0);
  };

  return (
    <div
      className="svc-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      /* on the container, not the stage: it catches the arrows and the front card by
         bubbling, so a keyboard user can tab to either and then steer with the arrows */
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setTurn((n) => n + 1);
        else if (e.key === "ArrowLeft") setTurn((n) => n - 1);
        else return;
        e.preventDefault();
      }}
    >
      <div
        className="svc-stage"
        onPointerMove={lean}
        onPointerLeave={() => {
          level();
          dragFrom.current = null;
        }}
        onPointerDown={(e) => {
          dragFrom.current = e.clientX;
          dragged.current = false;
        }}
        onPointerUp={(e) => {
          if (dragFrom.current === null) return;
          const dx = e.clientX - dragFrom.current;
          dragFrom.current = null;
          if (Math.abs(dx) <= DRAG) return;
          dragged.current = true;
          setTurn((n) => n + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => {
          dragFrom.current = null;
        }}
        /* dragstart bubbles, so this catches the link and the image both — without it
           the browser starts a native drag and the pointerup above never arrives */
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <motion.div className="svc-tilt" style={{ rotateY: sway, rotateX: tilt }}>
          {/* pushes the ring back by its own radius so the front facet lands on the
              perspective plane and renders at full size — no shrinking */}
          <div className="svc-dolly">
            <motion.div
              className="svc-ring"
              animate={{ rotateY: -turn * step }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 16 }}
            >
              {cards.map((c, i) => (
                <div
                  key={c.title}
                  className="svc-face"
                  /* only the facet at the front takes a click. The neighbours are
                     angled and half-hidden, so a click that lands on one is a miss,
                     not a choice — and it would still navigate. */
                  style={{ "--i": i, pointerEvents: i === active ? "auto" : "none" } as React.CSSProperties}
                >
                  <motion.div
                    className="svc-fly"
                    custom={i}
                    variants={reduced ? still : flyIn}
                    initial="packed"
                    animate={open ? "landed" : "packed"}
                  >
                    <ServiceCard card={c} front={i === active} />
                    {/* the two rearmost facets face away; without this you'd see
                        through to a mirrored card */}
                    <div className="svc-back" aria-hidden="true" />
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        <button className="svc-arrow left" aria-label="Previous" onClick={() => setTurn((n) => n - 1)} />
        <button className="svc-arrow right" aria-label="Next" onClick={() => setTurn((n) => n + 1)} />
      </div>
    </div>
  );
}

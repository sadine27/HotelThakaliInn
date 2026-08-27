"use client";

import { useEffect, useRef, useState } from "react";

/* Skeleton content — swap `src` in once the photos are picked. A slide with no
   src falls back to a tinted placeholder so the motion can be judged first. */
const SLIDES = [
  {
    title: "Five minutes from the runway",
    line: "Sinamangal, Kathmandu — the airport is closer than the taxi queue.",
    src: "",
  },
  {
    title: "Rooms that stay quiet",
    line: "Thick walls, hot water, and a bed made for the night before a flight.",
    src: "",
  },
  {
    title: "Breakfast, the Thakali way",
    line: "Dal, timur-tempered achar and buckwheat, served hot from seven.",
    src: "",
  },
  {
    title: "A courtyard to wait in",
    line: "Tea on the terrace while the Himalaya clears after the morning haze.",
    src: "",
  },
  {
    title: "Someone at the desk, always",
    line: "Late check-ins, early cabs, and a number that actually answers.",
    src: "",
  },
] as const;

const DWELL = 5200;
const BACKGROUND_VIDEO_SRC = "/media/RB6998.MP4";

/* points up; the next button flips it, and on mobile the pair rotates to
   left/right along with the slide direction */
const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HeroCarousel() {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(false);

  const go = (next: number, d = next > i ? 1 : -1) => {
    setPrev(i);
    setDir(d);
    setI((next + SLIDES.length) % SLIDES.length);
  };
  const step = (d: 1 | -1) => go(i + d, d);

  useEffect(() => {
    if (paused || open) return;
    const t = setTimeout(() => step(1), DWELL);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (open) return;
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (d) step(d as 1 | -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* swipe — horizontal on touch, which is also how the slides move there */
  const x0 = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") x0.current = e.clientX;
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !x0.current) return;
    const dx = e.clientX - x0.current;
    x0.current = 0;
    if (Math.abs(dx) > 44) step(dx < 0 ? 1 : -1);
  };

  /* in = on stage, out = the one just leaving, idle = parked off-stage with no
     transition, so it snaps back to its entry side without animating. */
  const state = (n: number) => (n === i ? "in" : n === prev ? "out" : "idle");

  return (
    <>
      <div className="ambient-video" aria-hidden="true">
        <video autoPlay muted loop playsInline preload="metadata">
          <source src={BACKGROUND_VIDEO_SRC} type="video/mp4" />
        </video>
      </div>

      {/* what the page opens onto — sits behind the two halves */}
      <div className="beyond" data-open={open || undefined}>
        <p className="beyond-eyebrow">Inside</p>
        <p className="beyond-note">The next chapter goes here.</p>
        <button className="gate-btn small" onClick={() => setOpen(false)}>
          Back
        </button>
      </div>

      <section
      className="hero"
      data-open={open || undefined}
      style={{ "--dir": dir } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onDown}
      onPointerUp={onUp}
      aria-roledescription="carousel"
      aria-label="Hotel Thakali Inn"
    >
      <div className="leaf leaf-l">
      <div className="hero-frame">
        {SLIDES.map((s, n) => (
          <figure key={s.title} className="hero-shot" data-state={state(n)}>
            {s.src ? (
              <img src={s.src} alt="" />
            ) : (
              <span className="hero-ph">{String(n + 1).padStart(2, "0")}</span>
            )}
          </figure>
        ))}
      </div>
      </div>

      <div className="leaf leaf-r">
      <div className="hero-copy">
        <p className="hero-eyebrow">Hotel Thakali Inn</p>

        <div className="hero-deck">
          {SLIDES.map((s, n) => (
            <article key={s.title} className="hero-text" data-state={state(n)}>
              <h2>{s.title}</h2>
              <p>{s.line}</p>
            </article>
          ))}
        </div>

        <div className="hero-rail">
          <button className="hero-arrow" aria-label="Previous" onClick={() => step(-1)}>
            <Chevron />
          </button>
          <button className="hero-arrow next" aria-label="Next" onClick={() => step(1)}>
            <Chevron />
          </button>

          {SLIDES.map((s, n) => (
            <button
              key={s.title}
              aria-current={n === i || undefined}
              aria-label={s.title}
              className="hero-tick"
              onClick={() => go(n)}
            />
          ))}
          <span className="hero-count">
            {String(i + 1).padStart(2, "0")}
            <i>/</i>
            {String(SLIDES.length).padStart(2, "0")}
          </span>
        </div>
      </div>
      </div>

      {/* sits on the seam the page opens along */}
      <div className="gate" aria-hidden={open || undefined}>
        <button
          className="gate-btn"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          tabIndex={open ? -1 : undefined}
        >
          Explore
        </button>
      </div>
    </section>
    </>
  );
}

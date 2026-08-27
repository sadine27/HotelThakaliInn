"use client";

import { useEffect, useRef, useState } from "react";
import ServicesCarousel from "@/components/ServicesCarousel";

/* Skeleton content — swap `src` in once the photos are picked. A slide with no
   src falls back to a tinted placeholder so the motion can be judged first. */
const SLIDES = [
  {
    title: "Five minutes from the runway",
    line: "Sinamangal, Kathmandu — close enough to hear the last boarding call and still make it.",
    src: "/media/hero/arrival.jpg",
  },
  {
    title: "A bed built for landing days",
    line: "Warm wood, thick curtains, hot water on demand — the duplex king, turned down and waiting.",
    src: "/media/hero/rooms.jpg",
  },
  {
    title: "Breakfast, the Thakali way",
    line: "A full spread from seven — eggs, fruit, toast and tea, laid out for early flights and slow mornings alike.",
    src: "/media/hero/breakfast.jpg",
  },
  {
    title: "Someone at the desk, always",
    line: "Late check-ins, early cabs — reception at Hotel Thakali Inn never goes dark.",
    src: "/media/hero/desk.jpg",
  },
] as const;

const DWELL = 5200;
/* Web derivative of the camera master (RB6998.MP4). The master is High 4:2:2
   10-bit at 47 Mbit/s with its moov atom at the end of 134 MB — a profile most
   browsers can't decode, in a layout that can't start until the whole file has
   arrived. This one is 8-bit 4:2:0 High, audio stripped, +faststart. See
   scripts/encode-ambient.sh to regenerate it. */
const BACKGROUND_VIDEO_SRC = "/media/ambient.mp4";

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
        <video autoPlay muted loop playsInline preload="auto">
          <source src={BACKGROUND_VIDEO_SRC} type="video/mp4" />
        </video>
      </div>

      {/* what the page opens onto — sits behind the two halves */}
      <div className="beyond" data-open={open || undefined}>
        <p className="beyond-eyebrow">Inside</p>
        <p className="beyond-note">Everything the stay is made of.</p>
        <ServicesCarousel open={open} />
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

        <div className="hero-cta-row">
          <a
            className="hero-cta"
            href="https://www.booking.com/hotel/np/thakali-inn.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="hero-cta-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M14 4h6v6M20 4l-8 8M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Book on Booking.com
          </a>
          <a
            className="hero-cta"
            href="https://www.google.com/maps/place/Hotel+Thakali+Inn/@27.6954876,85.2756856,12z"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="hero-cta-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.5 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.7 16.3 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.5 5.5C39.5 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"
                />
              </svg>
            </span>
            Google Reviews
          </a>
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

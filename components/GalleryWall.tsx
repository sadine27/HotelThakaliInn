"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* The loops in public/media/gallery were cut from the property's own footage by
   scripts/export-gallery-clips.mjs — that file records which camera clip each
   one came from, which window of it, and why. They are silent, 9.9s ping-pong
   loops, so nothing here needs sound, controls, or a loop seam to hide.

   The panels arrive from D1 through app/gallery/page.tsx, in the order a guest
   meets the building: off the road, past the desk, through the lobby, up to a
   room and around it, then back down to breakfast. That order is the `position`
   column, so staff can change it.

   `poster` and `src` are carried on the row rather than built from the slug.
   They used to be derived; the moment a slug is editable, deriving them means a
   rename silently orphans the clip. */
export type Panel = {
  slug: string;
  title: string;
  tag: string;
  blurb: string;
  image: string;
  video: string;
};

/* Six is what the accordion's flex math is built around: one stripe at
   flex-grow 5 beside five at 1 is about half the screen against a tenth each.
   The list is longer than the window, so the window slides over it — but only
   six columns ever exist in the DOM, and the arithmetic never changes. */
const VISIBLE = 6;
/* Long enough to read a stripe's name, short enough that a visitor who never
   touches anything still sees the far end of the list. */
const DWELL = 5000;
/* How long the outgoing stripe takes to cross out, and how far apart the six
   columns start doing it. Six at once is an event that happens to the whole
   wall; 90ms apart is something that travels across it. Both live here rather
   than in the stylesheet because this file also has to know when the last
   column has finished so it can unmount the layer. */
const SWAP = 1150;
const STAGGER = 90;

function windowFrom(panels: Panel[], start: number): Panel[] {
  return Array.from(
    { length: VISIBLE },
    (_, i) => panels[(start + i) % panels.length]
  );
}

export default function GalleryWall({ panels }: { panels: Panel[] }) {
  /* `start` is an index into `panels`: which panel sits in the leftmost slot.
     `active` is a SLOT index, 0..VISIBLE-1 — NOT a panel index, and that
     distinction is the whole safety argument for this component.

     The grid this page replaced re-indexed itself on hover, which slid a
     different panel into the slot under a stationary cursor, which re-fired
     that slot's hover, which re-indexed again: a next/previous flicker with no
     exit. Slots here are fixed. A window shift changes what a slot CONTAINS,
     but the element under the cursor is the same element it was a frame ago, so
     nothing can re-enter itself and no loop can form. */
  const [start, setStart] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  /* A guest's own pause, distinct from every other reason a clip isn't
     playing (closed, reduced motion, window shift). Reset whenever a
     different stripe opens, so pausing one clip never carries into the
     next. */
  const [videoPaused, setVideoPaused] = useState(false);
  /* The window that just left, kept alive on top of the one that replaced it
     for the length of the cross. `turn` only exists to re-key it, so two moves
     in quick succession restart the animation instead of continuing the first. */
  const [out, setOut] = useState<{
    turn: number;
    dir: number;
    win: Panel[];
  } | null>(null);
  const reduced = useReducedMotion();
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  /* How the open stripe was opened. Under prefers-reduced-motion a passing
     pointer must not start footage moving, but someone who deliberately clicks
     is asking for it — without this the setting hides the page's whole content
     from exactly the people who set it. */
  const deliberate = useRef(false);
  /* Whether the last window move came from a person. The timer must not narrate
     itself to a screen reader every five seconds; an arrow press should. */
  const manual = useRef(false);
  const startRef = useRef(0);
  const turn = useRef(0);
  const outTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* With six or fewer panels the window covers everything, so a carousel would
     be a no-op: no arrows, no timer, and this is exactly the accordion it was
     before. */
  const rotates = panels.length > VISIBLE;

  const moveWindow = useCallback(
    (d: number, byUser = false) => {
      if (!rotates) return;

      const from = startRef.current;
      const next = (from + d + panels.length) % panels.length;
      if (from === next) return;

      if (byUser) manual.current = true;
      startRef.current = next;

      if (outTimer.current) {
        clearTimeout(outTimer.current);
      }

      if (reduced) {
        setOut(null);
      } else {
        const nextTurn = turn.current + 1;
        turn.current = nextTurn;
        setOut({
          turn: nextTurn,
          /* which way the window went, so the stagger and drift run with it. */
          dir: (next - from + panels.length) % panels.length === 1 ? 1 : -1,
          win: windowFrom(panels, from),
        });
        outTimer.current = setTimeout(
          () => {
            setOut((current) => (current?.turn === nextTurn ? null : current));
            outTimer.current = null;
          },
          SWAP + (VISIBLE - 1) * STAGGER + 90
        );
      }

      setStart(next);
    },
    [panels, reduced, rotates]
  );

  const step = useCallback(
    (d: number) => {
      moveWindow(d, true);
    },
    [moveWindow]
  );

  const win = windowFrom(panels, start);

  /* Idle attract loop. It stops the moment a stripe opens — and because `active`
     is a dependency, keyboard focus stops it too, since focus opens a stripe.

     Pausing on the stage's own pointerenter would not work: the stage IS the
     viewport, so the first mouse movement anywhere on the page would kill the
     timer for good. Tying it to an open stripe instead means it runs where it
     is actually wanted — before the pointer arrives, after it leaves the window,
     and continuously on a touch screen, where there is no hover at all. */
  useEffect(() => {
    if (!rotates || reduced || active !== null) return;
    const id = setInterval(() => moveWindow(1), DWELL);
    return () => clearInterval(id);
  }, [rotates, reduced, active, moveWindow]);

  /* One playing clip at a time. Twelve decoders at once is what turns a page
     like this into a fan-speed demo, and preload="none" means the ones that
     have never been opened have not been fetched at all. `start` is a
     dependency because a window shift can swap the source under the open
     slot. */
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active && (!reduced || deliberate.current) && !videoPaused) {
        /* play() rejects when a pause lands on top of it — normal when the
           pointer crosses two stripes quickly, not an error worth surfacing */
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [active, start, reduced, videoPaused]);

  /* A pause is scoped to the stripe it was pressed on — opening a different
     one, or reopening this one, starts from playing again. */
  useEffect(() => {
    setVideoPaused(false);
  }, [active]);

  /* moveWindow captures the leaving window before `start` changes. Reduced
     motion clears any overlay so the wall cuts cleanly to the next set. */
  useEffect(() => {
    if (!reduced) return;
    if (outTimer.current) clearTimeout(outTimer.current);
    outTimer.current = null;
    /* Not derived state being resynced — this is the wall reacting to the OS
       telling us, mid-transition, that it wants no motion. The leaving overlay
       is already on screen at that point and has to be dropped from outside the
       render that drew it. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOut(null);
  }, [reduced]);

  useEffect(() => {
    return () => {
      if (outTimer.current) clearTimeout(outTimer.current);
    };
  }, []);

  /* Announce only what a person caused. Reading the panel numbers rather than
     the titles keeps it short; the titles are on the stripes themselves. */
  useEffect(() => {
    if (!manual.current) return;
    manual.current = false;
    setAnnounce(
      `Panels ${start + 1} to ${((start + VISIBLE - 1) % panels.length) + 1} of ${panels.length}`
    );
    /* panels.length is read above, so it belongs here. Adding it cannot cause a
       stray announcement: manual.current is false unless a keypress or a click
       set it a moment ago, and the effect returns on that before saying
       anything. */
  }, [start, panels.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      else if (rotates && e.key === "ArrowRight") step(1);
      else if (rotates && e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rotates, step]);

  const open = (i: number, byClick: boolean) => {
    deliberate.current = byClick;
    setActive(i);
  };

  return (
    <div className="gal-page">
      {/* Over the stripes rather than above them — the stage is the whole
          viewport, so there is no band to put a header in. pointer-events:none
          in CSS keeps it from stealing hover from the stripe underneath. */}
      <header className="gal-head" data-dim={active !== null || undefined}>
        <h1>Gallery · Sinamangal</h1>
        <p className="gal-hint">Twelve stops. Point at one.</p>
      </header>

      {/* Tab order has to read the way the page looks: previous sits on the
          left edge, so it comes before the stripes, and next follows them.
          Both live outside .gal-head deliberately — the header fades out
          whenever a stripe is open, and a control that disappears when you
          reach for it is worse than no control at all. */}
      {rotates && (
        <button
          type="button"
          className="gal-nav"
          data-dir="prev"
          aria-label="Show previous panels"
          onClick={() => step(-1)}
        >
          <Chevron dir="prev" />
        </button>
      )}

      {/* Collapse when the pointer leaves the wall entirely — including onto
          the dial, which is fixed above the stage but is not inside it. */}
      <div className="gal-stage" onMouseLeave={() => setActive(null)}>
        {win.map((p, i) => (
          /* key is the SLOT, not the panel: a window shift must change what
             this column shows without remounting it, or the flex-grow
             transition restarts from scratch mid-slide. */
          <div key={i} className="gal-col" data-open={i === active || undefined}>
            {/* key IS the panel here, so a swapped stripe gets a fresh element
                that loads its own source, rather than needing a manual load()
                on an element that is already playing something else.

                The prefix is not decoration. This element and .gal-copy below
                are siblings inside one column and both key off the panel, so a
                bare slug collides the moment a stripe is open — React then
                duplicates or drops one of them and `active` starts landing on
                the wrong slot. Keep the two namespaces distinct. */}
            <video
              key={`media-${p.slug}`}
              ref={(el) => {
                videos.current[i] = el;
              }}
              className="gal-media"
              poster={p.image}
              src={p.video}
              muted
              loop
              playsInline
              preload="none"
              tabIndex={-1}
            />
            <span className="gal-tint" aria-hidden="true" />
            <span className="gal-veil" aria-hidden="true" />

            {/* The control is its own element covering the stripe, rather than
                a <button> wrapped round everything: wrapping would fold the
                whole blurb into the button's accessible name, so a screen
                reader would announce forty words where "Reception" is meant.
                It also gives hover one box that never moves or resizes under
                the cursor, which is the other half of the flicker fix. */}
            <button
              type="button"
              className="gal-hit"
              aria-label={p.title}
              aria-expanded={i === active}
              /* pointerenter, not mouseenter, and only for a real mouse: a tap
                 fires the compatibility mouseenter FIRST, so with mouseenter
                 here the stripe would already be open by the time the tap's
                 click landed and the toggle below would shut what it opened */
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") open(i, false);
              }}
              /* focus mirrors hover so a keyboard walks the wall the same way a
                 pointer does; Escape puts it back */
              onFocus={() => open(i, false)}
              onClick={() => {
                /* Under reduced motion a hover opened this stripe without
                   starting it. The click that follows means "play", not
                   "close" — closing here would leave the footage unreachable. */
                const v = videos.current[i];
                if (i === active && v?.paused) {
                  deliberate.current = true;
                  v.play().catch(() => {});
                  return;
                }
                if (i === active) {
                  setActive(null);
                  return;
                }
                open(i, true);
              }}
            />

            {/* aria-hidden because the button above already announces the same
                word as its label — without this every stripe is read twice */}
            <span className="gal-label" aria-hidden="true">
              {p.title}
            </span>

            {/* Motion a guest didn't ask to keep looking at, without closing
                the stripe to escape it. Own element, not folded into .gal-hit,
                for the same reason .gal-hit is its own element over the blurb:
                a click here must not also mean open/close. */}
            {i === active && (
              <button
                type="button"
                className="gal-pause"
                aria-label={videoPaused ? "Play video" : "Pause video"}
                aria-pressed={videoPaused}
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoPaused((v) => !v);
                }}
              >
                <PauseIcon playing={!videoPaused} />
              </button>
            )}

            {/* The stripe this slot showed a moment ago, crossing out over the
                one that took its place. A copy of the column rather than just
                its frame — see .gal-out — and inert to both the pointer and a
                screen reader, which have the live column underneath. */}
            {out && (
              <div
                key={`out-${out.turn}`}
                className="gal-out"
                data-dir={out.dir > 0 ? "next" : "prev"}
                aria-hidden="true"
                style={{
                  animationDuration: `${SWAP}ms`,
                  animationDelay: `${(out.dir > 0 ? i : VISIBLE - 1 - i) * STAGGER}ms`,
                }}
              >
                <img
                  className="gal-media"
                  src={out.win[i].image}
                  alt=""
                />
                <span className="gal-tint" />
                <span className="gal-veil" />
                <span className="gal-label">{out.win[i].title}</span>
              </div>
            )}

            {/* Mounted only while open, and keyed by panel, so both opening a
                stripe and advancing the window under an open one re-run the
                rise rather than swapping words under a block already in place.
                No framer-motion needed for that — a remount restarts the CSS
                animation on its own. */}
            {i === active && (
              <div key={`copy-${p.slug}`} className="gal-copy">
                <p className="gal-meta">
                  <i>
                    {String(((start + i) % panels.length) + 1).padStart(2, "0")}
                  </i>{" "}
                  / {String(panels.length).padStart(2, "0")} · {p.tag}
                </p>
                <h2 className="gal-title">{p.title}</h2>
                <p className="gal-blurb">{p.blurb}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {rotates && (
        <>
          <button
            type="button"
            className="gal-nav"
            data-dir="next"
            aria-label="Show next panels"
            onClick={() => step(1)}
          >
            <Chevron dir="next" />
          </button>

          <p className="gal-sr" aria-live="polite">
            {announce}
          </p>
        </>
      )}
    </div>
  );
}

/* Square caps and a heavy stroke rather than a rounded icon-set chevron — the
   page is set in Manrope 800 caps and a soft arrow would be the one apologetic
   thing on it. Two glyphs do not justify an icon dependency. */
/* Two bars / one triangle, same square-capped stroke as Chevron — one more
   glyph still doesn't justify an icon dependency. */
function PauseIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {playing ? (
        <>
          <path d="M9 4 L9 20" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="square" />
          <path d="M15 4 L15 20" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="square" />
        </>
      ) : (
        <path d="M6 4 L19 12 L6 20 Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={dir === "prev" ? "M15.5 3 L6.5 12 L15.5 21" : "M8.5 3 L17.5 12 L8.5 21"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

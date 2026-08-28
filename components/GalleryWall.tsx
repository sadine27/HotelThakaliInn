"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* The loops in public/media/gallery were cut from the property's own footage by
   scripts/export-gallery-clips.mjs — that file records which camera clip each
   one came from, which window of it, and why. They are silent, 9.9s ping-pong
   loops, so nothing here needs sound, controls, or a loop seam to hide.

   Order is the order a guest meets the building: off the road, past the desk,
   through the lobby, up to a room and around it, then back down to breakfast. */
const PANELS = [
  {
    slug: "signage",
    title: "Off the Road",
    tag: "Sinamangal",
    blurb:
      "The sign is the landmark — hotel and restaurant on one board, hung off the first floor over the pavement. Look up for it; the doorway underneath is easy to walk straight past.",
  },
  {
    slug: "arrival",
    title: "Reception",
    tag: "Front desk",
    blurb:
      "The desk is staffed through the night, which is the only thing that matters when the flight lands at two in the morning. The airport is 950 m up the road.",
  },
  {
    slug: "lobby",
    title: "The Waiting Room",
    tag: "Ground floor",
    blurb:
      "Red floor, low chairs, and somewhere to sit with the bags while a room is turned over. Most people meet their driver here.",
  },
  {
    slug: "corridor",
    title: "The Corridor",
    tag: "Doors off it",
    blurb:
      "Rooms open off a short passage rather than a long hotel spine, so there is never far to carry anything. A door left ajar is how most of them are found.",
  },
  {
    slug: "rooms",
    title: "The Rooms",
    tag: "Eighteen of them",
    blurb:
      "Three types across two floors — a double, a king, and two family rooms. Wood underfoot, curtains that actually black out, and walls built for a road that never quite sleeps.",
  },
  {
    slug: "bedside",
    title: "The Bedside",
    tag: "Lamp and line",
    blurb:
      "A reading lamp on a swing arm, a phone through to the desk, and a framed print of the mountains most guests are on their way to.",
  },
  {
    slug: "window",
    title: "The Window",
    tag: "Two chairs",
    blurb:
      "Curtains to the floor, two low chairs and a table between them. This is the corner of the room people actually sit in.",
  },
  {
    slug: "minibar",
    title: "The Minibar",
    tag: "Under the television",
    blurb:
      "Water, soft drinks, a beer and a shelf of snacks, inside the cabinet below the television. Nothing in it needs a phone call first.",
  },
  {
    slug: "bathrooms",
    title: "The Bathrooms",
    tag: "One per room",
    blurb:
      "Private to every room. A wide mirror, a long vanity, and enough counter left over to put a wash bag down on.",
  },
  {
    slug: "dining",
    title: "The Dining Hall",
    tag: "Seven to ten",
    blurb:
      "Tables laid from early morning. It fills at seven, empties by ten, and is one of the quietest rooms in the building in between.",
  },
  {
    slug: "buffet",
    title: "The Buffet",
    tag: "Hot counter",
    blurb:
      "Chafing dishes along the back wall, tables pulled up in front of them. Eggs, sausage, fruit and toast are laid out here and you help yourself.",
  },
  {
    slug: "breakfast",
    title: "Breakfast",
    tag: "Thakali, plated",
    blurb:
      "Dal, rice, greens, and the pickle that makes the plate. The Thakali set is the one thing cooked to order, which is why it takes a minute.",
  },
] as const;

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
   wall; 80ms apart is something that travels across it. Both live here rather
   than in the stylesheet because this file also has to know when the last
   column has finished so it can unmount the layer. */
const SWAP = 900;
const STAGGER = 80;

export default function GalleryWall() {
  /* `start` is an index into PANELS: which panel sits in the leftmost slot.
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
  /* The window that just left, kept alive on top of the one that replaced it
     for the length of the cross. `turn` only exists to re-key it, so two moves
     in quick succession restart the animation instead of continuing the first. */
  const [out, setOut] = useState<{
    turn: number;
    dir: number;
    win: (typeof PANELS)[number][];
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
  const prevStart = useRef(0);
  const turn = useRef(0);

  /* With six or fewer panels the window covers everything, so a carousel would
     be a no-op: no arrows, no timer, and this is exactly the accordion it was
     before. */
  const rotates = PANELS.length > VISIBLE;

  const step = useCallback((d: number) => {
    manual.current = true;
    setStart((s) => (s + d + PANELS.length) % PANELS.length);
  }, []);

  const win = Array.from(
    { length: VISIBLE },
    (_, i) => PANELS[(start + i) % PANELS.length]
  );

  /* Idle attract loop. It stops the moment a stripe opens — and because `active`
     is a dependency, keyboard focus stops it too, since focus opens a stripe.

     Pausing on the stage's own pointerenter would not work: the stage IS the
     viewport, so the first mouse movement anywhere on the page would kill the
     timer for good. Tying it to an open stripe instead means it runs where it
     is actually wanted — before the pointer arrives, after it leaves the window,
     and continuously on a touch screen, where there is no hover at all. */
  useEffect(() => {
    if (!rotates || reduced || active !== null) return;
    const id = setInterval(
      () => setStart((s) => (s + 1) % PANELS.length),
      DWELL
    );
    return () => clearInterval(id);
  }, [rotates, reduced, active]);

  /* One playing clip at a time. Twelve decoders at once is what turns a page
     like this into a fan-speed demo, and preload="none" means the ones that
     have never been opened have not been fetched at all. `start` is a
     dependency because a window shift can swap the source under the open
     slot. */
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active && (!reduced || deliberate.current)) {
        /* play() rejects when a pause lands on top of it — normal when the
           pointer crosses two stripes quickly, not an error worth surfacing */
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [active, start, reduced]);

  /* Snapshot the window that is leaving. Under reduced motion nothing is
     rendered at all — the wall simply is what it is now, which is the same cut
     the rest of the site makes rather than a shortened animation. */
  useEffect(() => {
    const from = prevStart.current;
    if (from === start) return;
    prevStart.current = start;
    if (reduced) return;

    turn.current += 1;
    setOut({
      turn: turn.current,
      /* which way the window went, so the stagger runs with it. A step is
         always one, so anything that is not +1 is the wrap or a step back. */
      dir: (start - from + PANELS.length) % PANELS.length === 1 ? 1 : -1,
      win: Array.from(
        { length: VISIBLE },
        (_, i) => PANELS[(from + i) % PANELS.length]
      ),
    });
    const id = setTimeout(() => setOut(null), SWAP + (VISIBLE - 1) * STAGGER + 60);
    return () => clearTimeout(id);
  }, [start, reduced]);

  /* Announce only what a person caused. Reading the panel numbers rather than
     the titles keeps it short; the titles are on the stripes themselves. */
  useEffect(() => {
    if (!manual.current) return;
    manual.current = false;
    setAnnounce(
      `Panels ${start + 1} to ${((start + VISIBLE - 1) % PANELS.length) + 1} of ${PANELS.length}`
    );
  }, [start]);

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
              poster={`/media/gallery/${p.slug}.jpg`}
              src={`/media/gallery/${p.slug}.mp4`}
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

            {/* The stripe this slot showed a moment ago, crossing out over the
                one that took its place. A copy of the column rather than just
                its frame — see .gal-out — and inert to both the pointer and a
                screen reader, which have the live column underneath. */}
            {out && (
              <div
                key={`out-${out.turn}`}
                className="gal-out"
                aria-hidden="true"
                style={{
                  animationDuration: `${SWAP}ms`,
                  animationDelay: `${(out.dir > 0 ? i : VISIBLE - 1 - i) * STAGGER}ms`,
                }}
              >
                <img
                  className="gal-media"
                  src={`/media/gallery/${out.win[i].slug}.jpg`}
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
                    {String(((start + i) % PANELS.length) + 1).padStart(2, "0")}
                  </i>{" "}
                  / {String(PANELS.length).padStart(2, "0")} · {p.tag}
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

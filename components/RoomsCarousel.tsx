"use client";

import { useEffect, useRef, useState } from "react";
import Img from "@/components/Img";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LiquidBackground from "./LiquidBackground";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { DRAG, SWAY } from "@/lib/carousel";

/* Room types, capacities and counts come from the property's Booking.com listing
   (ids 1618318901/02/03 — recorded in the plan, deliberately not rendered).
   Capacity here is how many people fit, not availability: nothing on this page
   is live, and no rate appears anywhere because rates vary.

   The rows arrive from D1 through app/rooms/page.tsx. `meta` carries only what
   DISTINGUISHES a room — anything every room has is in the `shared` prop, and
   repeating it three times is noise. `specs` is the same facts spelled out for
   the detail view, where there is room to name them. */
export type Room = {
  slug: string;
  name: string;
  capacity: string;
  count: string;
  blurb: string;
  meta: string[];
  specs: [string, string][];
  image: string;
};

/* A fan, not a closed ring. The services carousel spaces its facets at 360/n,
   which works at five cards (72°) but degenerates at three: 120° turns both
   neighbours edge-on and they collapse to slivers. So the step is fixed here and
   the three cards ride a shallow arc instead of a cylinder.

   At either end the far card does turn past 90°, but .svc-card's
   backface-visibility drops it from view rather than mirroring it, so unlike the
   services ring there is no card back to draw. */
const STEP = 58;

/* An arc has ends, and rolling the fan back two steps to reach the far one reads
   as an undo rather than as going forward. So the ends join behind a dip — but a
   dip alone is just a cut with a fade on it. What makes the seam read as travel
   is that the fan never stops moving in the direction you asked for: it carries
   one step PAST the last facet as it dims, is repositioned one step BEFORE the
   far facet while it is invisible, and rides that last step home as it lifts.
   Same sweep throughout, so the eye is handed across rather than blinked across.

   Out is quicker than in — leaving should feel decisive, arriving unhurried.
   Both must match .room-stage's opacity transitions in globals.css. */
const WRAP_OUT = 300;
const WRAP_HOLD = 60; /* one certain painted frame at the repositioned angle */
const WRAP_IN = 460;

function RoomCard({
  room,
  front,
  onOpen,
}: {
  room: Room;
  front: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className="svc-card room-card"
      data-active={front || undefined}
      onClick={front ? onOpen : undefined}
      role={front ? "button" : undefined}
      tabIndex={front ? 0 : undefined}
      onKeyDown={
        front
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      <div className="svc-well">
        <Img src={room.image} alt="" fill sizes="(max-width: 900px) 88vw, 46vw" className="svc-media" priority={front} />
        <div className="svc-scrim" />
      </div>
      <div className="svc-content">
        <span className="svc-tag">{room.capacity}</span>
        <h3>{room.name}</h3>
      </div>
    </article>
  );
}

export default function RoomsCarousel({
  rooms,
  shared,
  size,
  goodToKnow,
  bookingUrl,
}: {
  rooms: Room[];
  /* What every room has, so the per-room chips can carry only the differences */
  shared: string;
  /* One approximate figure, for the SMALLEST room, given as approximate. Three
     exact per-room sizes derived from it would be invented, and guests compare
     this page against Booking. */
  size: string;
  /* Hotel-level and identical in all three rooms, so it is a setting rather than
     something copied into each row. */
  goodToKnow: string[];
  bookingUrl: string;
}) {
  const [turn, setTurn] = useState(0);
  /* false until mounted. The fan must not server-render: framer-motion rounds its
     transforms to 3dp on the client while React's SSR prints full precision, and
     the two disagree on hydration. */
  const [mounted, setMounted] = useState(false);
  /* the wrap's two extra pieces of state: `fade` dims the stage, `lead` is the
     overshoot in steps that keeps the sweep going in one direction across it */
  const [fade, setFade] = useState(false);
  const [lead, setLead] = useState(0);
  /* true only for the invisible reposition, where the fan must jump, not travel */
  const [snap, setSnap] = useState(false);
  const reduced = useReducedMotion();

  const router = useRouter();
  const params = useSearchParams();

  /* The URL is the only source of truth for whether the detail is open — a second
     piece of state would be one more thing that can disagree with the address bar.
     An unknown ?room= value simply reads as closed. */
  const openIndex = rooms.findIndex((r) => r.slug === params.get("room"));
  const open = openIndex >= 0;

  const total = rooms.length;
  const active = turn; /* no modulo — the fan is bounded, so turn IS the index */
  const room = rooms[active];

  const swayTo = useMotionValue(0);
  const sway = useSpring(swayTo, { stiffness: 60, damping: 18 });

  const dragFrom = useRef<number | null>(null);
  const wrapAt = useRef(0);
  /* Loaded straight into a detail? Then there is no /rooms entry behind us to pop
     back to, and router.back() would walk out of the site. Push once instead; from
     then on there is history to pop like anyone else's. */
  const deepLinked = useRef(open);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => window.clearTimeout(wrapAt.current), []);

  /* a shared or reloaded ?room= link has to bring the fan with it, so that closing
     the detail lands on the card it was opened from */
  useEffect(() => {
    if (openIndex >= 0) setTurn(openIndex);
  }, [openIndex]);

  const close = () => {
    if (deepLinked.current) {
      deepLinked.current = false;
      router.push("/rooms", { scroll: false });
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* every input routes through here, so the wrap lives in exactly one place */
  const go = (d: number) => {
    if (open) return; /* the fan is behind the detail — nothing to steer */
    if (fade) return; /* mid-wrap — the fan is already on its way somewhere */
    const next = turn + d;
    if (next >= 0 && next < total) {
      setTurn(next);
      return;
    }
    const far = next < 0 ? total - 1 : 0;
    if (reduced) {
      setTurn(far);
      return;
    }
    /* carry on past the end while dimming */
    setFade(true);
    setLead(d);
    wrapAt.current = window.setTimeout(() => {
      /* invisible: land one step short of the far card, on the near side, so the
         step still to come runs the same way as the step just made */
      setSnap(true);
      setTurn(far);
      setLead(-d);
      wrapAt.current = window.setTimeout(() => {
        /* and ride it in */
        setSnap(false);
        setLead(0);
        setFade(false);
      }, WRAP_HOLD);
    }, WRAP_OUT);
  };

  const lean = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || open) return;
    const r = e.currentTarget.getBoundingClientRect();
    swayTo.set(((e.clientX - r.left) / r.width - 0.5) * 2 * SWAY);
  };

  return (
    <div
      className="room-page"
      data-open={open || undefined}
      /* on the container, not the stage: it catches the arrows and the panel by
         bubbling, so a keyboard user can tab to either and then steer */
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") go(1);
        else if (e.key === "ArrowUp") go(-1);
        else return;
        e.preventDefault();
      }}
    >
      <div className="room-carousel">
        <div
          className="room-stage"
          data-fade={fade || undefined}
          onPointerMove={lean}
          onPointerLeave={() => {
            swayTo.set(0);
            dragFrom.current = null;
          }}
          onPointerDown={(e) => {
            dragFrom.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (dragFrom.current === null) return;
            const dy = e.clientY - dragFrom.current;
            dragFrom.current = null;
            if (Math.abs(dy) <= DRAG) return;
            /* drag up = the fan rolls forward, the way a scroll wheel reads */
            go(dy < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            dragFrom.current = null;
          }}
          /* dragstart bubbles, so this catches the image too — without it the
             browser starts a native drag and the pointerup above never arrives */
          onDragStart={(e) => e.preventDefault()}
        >
          {/* holds the fan's footprint until it can safely render */}
          {mounted && (
            <motion.div className="room-tilt" style={{ rotateY: sway }}>
              {/* pushes the arc back by its own radius so the front facet lands
                  on the perspective plane and renders at full size */}
              <div className="room-dolly">
                <motion.div
                  className="room-fan"
                  animate={{ rotateX: (turn + lead) * STEP }}
                  transition={reduced || snap ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 16 }}
                >
                  {rooms.map((r, i) => (
                    <div key={r.name} className="room-face" style={{ "--i": i } as React.CSSProperties}>
                      <RoomCard
                        room={r}
                        front={i === active}
                        onOpen={() => router.push(`/rooms?room=${r.slug}`, { scroll: false })}
                      />
                    </div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>

        <button className="room-arrow up" aria-label="Previous room" onClick={() => go(-1)} />
        <button className="room-arrow down" aria-label="Next room" onClick={() => go(1)} />

        {/* The detail, in the column the fan is vacating. inert while collapsed so a
            Tab can never land in a zero-width column. The room's own photo rides
            along as --shot and is blurred out behind the glass. */}
        <section
          className="room-view"
          style={{ "--shot": `url(${room.image})` } as React.CSSProperties}
          inert={!open}
          aria-hidden={!open || undefined}
        >
          {/* The liquid ground. Only while the detail is open — unmounting is what
              stops the frame loop. NOT also gated on `reduced` here: that reads
              differently on the server and on the client, so the canvas would
              hydrate into a mismatch. The component makes that call itself, in
              an effect, where only the client ever runs it. */}
          {open ? <LiquidBackground /> : null}

          <button className="room-back" onClick={close}>
            <span aria-hidden="true">←</span> Back
          </button>

          <header className="room-view-head">
            <span className="room-eyebrow">{room.count}</span>
            <h2>{room.name}</h2>
            <p className="room-blurb">{room.blurb}</p>
          </header>

          <div className="room-view-body">
            {/* 3D tour mounts here. Deliberately empty until there is one — a photo
                behind a "coming soon" scrim would only be the card above again. */}
            <div className="room-tour">
              <span>3D tour · coming soon</span>
            </div>

            <div className="room-facts">
              <dl className="room-specs">
                {room.specs.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="room-group">
                <span>In this room</span>
                <ul className="room-meta">
                  {room.meta.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="room-group">
                <span>In every room</span>
                <p>{shared}</p>
              </div>

              <div className="room-group">
                <span>Good to know</span>
                <ul className="room-know">
                  {goodToKnow.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>

              <p className="room-size">{size}</p>

              <a className="room-book" href={bookingUrl}>
                Check availability →
              </a>
            </div>
          </div>
        </section>
      </div>

      <aside className="room-panel" aria-live="polite" inert={open} aria-hidden={open || undefined}>
        <span className="room-eyebrow">Rooms</span>
        {/* keyed, so the panel re-mounts and re-runs its enter on every turn */}
        <motion.div
          key={active}
          className="room-detail"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
        >
          <h1>{room.name}</h1>
          <p className="room-blurb">{room.blurb}</p>
          <ul className="room-meta">
            {room.meta.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="room-count">{room.count}</p>
        </motion.div>

        <div className="room-actions">
          <button className="room-more" onClick={() => router.push(`/rooms?room=${room.slug}`, { scroll: false })}>
            Know more <span aria-hidden="true">→</span>
          </button>
          <a className="room-book" href={bookingUrl}>
            Check availability →
          </a>
          <Link className="room-book" href={`/book?room=${room.slug}`}>
            Request this room
          </Link>
        </div>

        <span className="room-index">
          {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>

        <p className="room-shared">
          <span>In every room</span> {shared}
        </p>
      </aside>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const CARDS = [
  { title: "Rooms", tag: "Stay", description: "Thick walls, hot water, a bed made for the night before a flight.", href: "/rooms", image: "/media/services/rooms.jpg" },
  { title: "Breakfast", tag: "Thakali", description: "Dal, timur-tempered achar and buckwheat, served hot from seven.", href: "/breakfast", image: "/media/services/breakfast.jpg" },
  { title: "Amenities", tag: "", description: "Everything the stay needs, nothing it doesn't.", href: "/amenities", image: "/media/services/amenities.jpg" },
  { title: "Gallery", tag: "", description: "The rooms, the courtyard, the desk — as they actually look.", href: "/gallery", image: "/media/services/gallery.jpg" },
  { title: "Contact", tag: "Always", description: "Late check-ins, early cabs, a number that actually answers.", href: "/contact", image: "/media/services/contact.jpg" },
] as const;

/* coverflow spacing — how far, how angled and how much smaller each step
   away from centre is. Small offsets so the neighbours stay legible instead
   of vanishing edge-on the way a full rotateY ring does. */
const SPACING = 340;
const ANGLE = 40;
const SCALE_STEP = 0.14;
const MAX_VISIBLE = 1;

function ServiceCard({ card, active }: { card: (typeof CARDS)[number]; active: boolean }) {
  return (
    <Link href={card.href} className="svc-card" data-active={active || undefined} tabIndex={active ? undefined : -1}>
      <Image
        src={card.image}
        alt=""
        fill
        sizes="(max-width: 820px) 90vw, 560px"
        className="svc-media"
        priority={active}
      />
      <div className="svc-scrim" />
      <div className="svc-content">
        {card.tag && <span className="svc-tag">{card.tag}</span>}
        <h3>{card.title}</h3>
        <p>{card.description}</p>
        <span className="svc-cta">Explore →</span>
      </div>
    </Link>
  );
}

/* shortest signed distance from `active`, wrapped around the deck */
function offsetOf(i: number, active: number, total: number) {
  let d = i - active;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  return d;
}

export default function ServicesCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mobile, setMobile] = useState(false);

  const total = CARDS.length;

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 820);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (paused || mobile) return;
    const t = setInterval(() => setActive((prev) => (prev + 1) % total), 4200);
    return () => clearInterval(t);
  }, [paused, mobile, total]);

  const goTo = (target: number) => setActive(target);
  const step = (d: 1 | -1) => goTo((active + d + total) % total);

  if (mobile) {
    return (
      <div className="svc-mobile">
        {CARDS.map((c) => (
          <ServiceCard key={c.title} card={c} active />
        ))}
      </div>
    );
  }

  return (
    <div className="svc-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="svc-stage">
        {CARDS.map((c, i) => {
          const d = offsetOf(i, active, total);
          const abs = Math.abs(d);
          const hidden = abs > MAX_VISIBLE;
          return (
            <motion.div
              key={c.title}
              className="svc-face"
              style={{ zIndex: 10 - abs, pointerEvents: hidden ? "none" : "auto" }}
              animate={{
                x: d * SPACING,
                z: -abs * 160,
                rotateY: -d * ANGLE,
                scale: 1 - abs * SCALE_STEP,
                opacity: hidden ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >
              <ServiceCard card={c} active={d === 0} />
            </motion.div>
          );
        })}
        <button className="svc-arrow left" aria-label="Previous" onClick={() => step(-1)} />
        <button className="svc-arrow right" aria-label="Next" onClick={() => step(1)} />
      </div>
      <div className="svc-dots">
        {CARDS.map((c, i) => (
          <button
            key={c.title}
            aria-current={i === active || undefined}
            aria-label={c.title}
            className="svc-dot"
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ADDRESS,
  BOOKING_URL,
  DIRECTIONS_URL,
  EMAIL,
  MAPS_URL,
  MAP_EMBED_URL,
  PHONE,
  PHONE_HREF,
  PLUS_CODE,
  SOCIALS,
} from "@/lib/site";

/* Four glyphs, hand-drawn, for the same reason GalleryWall draws its chevron: an
   icon package would be the largest dependency in a project whose only
   non-framework dep is framer-motion. */
const PATHS = {
  phone:
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  mail: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 7l10 7 10-7",
  external: "M14 4h6v6M20 4l-8 8M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

function Glyph({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={PATHS[name]}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Ordered by how a guest actually reaches us rather than by how impressive each
   one looks: the phone first because it is the one that works at 2am, the form
   last because it is the slowest. */
const CHANNELS = [
  { icon: "phone", label: "Call the desk", value: PHONE, href: PHONE_HREF, out: false },
  { icon: "mail", label: "Email", value: EMAIL, href: `mailto:${EMAIL}`, out: false },
  { icon: "external", label: "Reserve a room", value: "Booking.com", href: BOOKING_URL, out: true },
  { icon: "pin", label: "Find us · reviews", value: "Google Maps", href: MAPS_URL, out: true },
] as const;

/* The page's one loud thing. Airport proximity is this property's whole pitch and
   the only question a guest landing at midnight is actually asking, so it gets the
   mono spec treatment instead of being buried in a paragraph. The figures are the
   ones already used in the hero and services copy. */
const ARRIVAL: [string, string][] = [
  ["TIA terminal", "950 m"],
  ["Main entrance", "1.1 km"],
  ["Front desk", "Through the night"],
  ["Airport shuttle", "On request, paid"],
];

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const socials = SOCIALS.filter((s) => s.href);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    /* `required` and type="email" on the inputs do the field-level checking, so
       there is no validation code here to drift out of step with the browser's. */
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "That did not send.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send.");
      setStatus("error");
    }
  }

  async function copyPlusCode() {
    try {
      await navigator.clipboard.writeText(PLUS_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard is blocked on insecure origins and inside some embedded
         browsers. The code is selectable text either way, so nothing is lost. */
    }
  }

  return (
    <div className="con-page">
      <section className="con-side">
        <span className="con-eyebrow">Contact</span>
        <h1>Hotel Thakali Inn</h1>
        <p className="con-address">{ADDRESS}</p>
        <p className="con-blurb">
          Five minutes from the runway. The desk is staffed through the night — if
          you are landing late, call ahead and we will wait up.
        </p>

        <ul className="con-channels">
          {CHANNELS.map((c) => (
            <li key={c.label}>
              <a
                className="con-channel"
                href={c.href}
                {...(c.out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="con-channel-icon">
                  <Glyph name={c.icon} />
                </span>
                <span className="con-channel-text">
                  <span className="con-channel-label">{c.label}</span>
                  <span className="con-channel-value">{c.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        {socials.length > 0 && (
          <ul className="con-socials">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        <dl className="con-arrival">
          {ARRIVAL.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="con-main">
        <figure className="con-map">
          <iframe
            src={MAP_EMBED_URL}
            title="Hotel Thakali Inn on Google Maps"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <figcaption>
            <button type="button" className="con-code" onClick={copyPlusCode}>
              {copied ? "Copied" : PLUS_CODE}
            </button>
            <a
              className="con-directions"
              href={DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions <span aria-hidden="true">→</span>
            </a>
          </figcaption>
        </figure>

        {/* The form is the slow path and is drawn as one — quieter than the
            channels above it, which is also the honest order of usefulness. */}
        <div className="con-write">
          <span className="con-eyebrow">Write to us</span>
          {status === "sent" ? (
            <p className="con-sent" role="status">
              Message sent. We reply from {EMAIL}, usually within a day — call {PHONE}{" "}
              if it is urgent.
            </p>
          ) : (
            <form className="con-form" onSubmit={send}>
              {/* Bots fill every field they find. Guests never see this one. */}
              <input
                className="con-trap"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <label>
                <span>Name</span>
                <input name="name" type="text" required maxLength={80} autoComplete="name" />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" required maxLength={160} autoComplete="email" />
              </label>
              <label className="con-field-wide">
                <span>Message</span>
                <textarea name="message" required maxLength={2000} rows={3} />
              </label>
              <div className="con-actions">
                {status === "error" && (
                  <p className="con-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="con-send" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

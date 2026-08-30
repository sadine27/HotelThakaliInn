"use client";

import { useState } from "react";
import Glyph, { type GlyphName } from "./Glyph";
import { useLive } from "./Live";
import WhatsAppMark from "./WhatsAppMark";

/* Every outward-facing fact this page renders, resolved by app/contact/page.tsx.
   One object rather than twelve props: they are read together, they change
   together when staff edit them, and none of them means anything alone. */
export type ContactInfo = {
  phone: string;
  phoneHref: string;
  waHref: string;
  email: string;
  address: string;
  plusCode: string;
  bookingUrl: string;
  mapsUrl: string;
  mapEmbedUrl: string;
  directionsUrl: string;
  socials: { label: string; href: string }[];
  /* Airport proximity is this property's whole pitch and the only question a
     guest landing at midnight is actually asking. */
  arrival: [string, string][];
};

type Channel = {
  icon: GlyphName | "whatsapp";
  label: string;
  value: string;
  href: string;
  out: boolean;
  /* Exactly one row wears the brass. It is the fastest way to reach a person
     who is awake, and a page where five things shout is a page with no
     recommendation on it. */
  primary?: boolean;
};

/* Ordered by how a guest actually reaches us rather than by how impressive each
   one looks: WhatsApp first because it is what a traveller has on an airport
   wifi with no local SIM, the phone under it because it is what works when the
   wifi does not, and the form last because it is the slowest. */
const channels = (i: ContactInfo): Channel[] =>
  [
    i.waHref && {
      icon: "whatsapp" as const,
      label: "WhatsApp",
      value: i.phone,
      href: i.waHref,
      out: true,
      primary: true,
    },
    { icon: "phone" as const, label: "Call the desk", value: i.phone, href: i.phoneHref, out: false },
    { icon: "mail" as const, label: "Email", value: i.email, href: `mailto:${i.email}`, out: false },
    {
      icon: "external" as const,
      label: "Reserve a room",
      value: "Booking.com",
      href: i.bookingUrl,
      out: true,
    },
    {
      icon: "mail" as const,
      label: "Request a room",
      value: "Direct, no payment",
      href: "/book",
      out: false,
    },
    { icon: "pin" as const, label: "Find us · reviews", value: "Google Maps", href: i.mapsUrl, out: true },
  ].filter(Boolean) as Channel[];

/* "04:12" is a reading. "4:12 am" is a time of night, which is the thing the
   sentence around it is actually about. */
const clock12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactPanel({ info }: { info: ContactInfo }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const live = useLive();
  /* An account that has not been created yet is stored as an empty href and
     simply does not render, so adding one later is a single settings edit. */
  const socials = info.socials.filter((s) => s.href);

  /* The distance to the terminal, found by name rather than by position, so a
     staff member reordering the arrival list cannot silently relabel the runway
     as the bus park. Falls back to nothing, and the strip then just says how
     long it takes. */
  const toTerminal = info.arrival.find(([term]) => /terminal|airport|tia/i.test(term))?.[1];

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
      /* The Workers types make json() return unknown rather than any, which is
         correct — this is a response from the network, not a trusted value. */
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "That did not send.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send.");
      setStatus("error");
    }
  }

  async function copyPlusCode() {
    try {
      await navigator.clipboard.writeText(info.plusCode);
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
        {/* The page's job is to prove there is somebody there. A clock reading
            the real hour in Kathmandu does that in a way no sentence can — and
            it is null until the live payload lands, so the eyebrow underneath
            is what a visitor sees for the first few hundred milliseconds and
            what they see for good if the route is down. */}
        {live ? (
          <div className="con-now">
            <span className="con-now-clock">{clock12(live.time)}</span>
            <span className="con-now-where">
              in Kathmandu
              {live.sky ? ` · ${live.sky}` : ""}
              {live.temp !== null ? ` · ${live.temp}°` : ""}
            </span>
            <span className="con-now-desk">
              {live.daypart === "night" || live.daypart === "dawn"
                ? "The desk is awake."
                : "Someone is at the desk."}
            </span>
          </div>
        ) : (
          <span className="con-eyebrow">Contact</span>
        )}

        <h1>Hotel Thakali Inn</h1>
        <p className="con-address">{info.address}</p>
        <p className="con-blurb">
          Five minutes from the runway. The desk is staffed through the night — if
          you are landing late, call ahead and we will wait up.
        </p>

        <ul className="con-channels">
          {channels(info).map((c) => (
            <li key={c.label}>
              <a
                className={`con-channel${c.primary ? " con-channel--primary" : ""}`}
                href={c.href}
                {...(c.out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="con-channel-icon">
                  {c.icon === "whatsapp" ? <WhatsAppMark size={15} /> : <Glyph name={c.icon} />}
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
          {info.arrival.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="con-main">
        {/* The whole pitch, drawn: runway, a short line, our door. Two dots and
            a dash rather than a second map — the map below already shows where
            this is, and what this has to show is how little there is between
            the two ends of it. */}
        <div className="con-route" aria-label="The airport is a few minutes away">
          <div className="con-route-stop">
            <span className="con-route-dot" aria-hidden="true" />
            <strong>The runway</strong>
            <span>Tribhuvan International</span>
          </div>
          <div className="con-route-leg">
            <span className="con-route-leg-line" aria-hidden="true" />
            <span className="con-route-leg-text">
              {toTerminal ? `${toTerminal} · ` : ""}about 5 minutes
            </span>
          </div>
          <div className="con-route-stop con-route-stop--end">
            <span className="con-route-dot" aria-hidden="true" />
            <strong>Our door</strong>
            <span>Sinamangal Kalimatidol</span>
          </div>
        </div>

        <figure className="con-map">
          <iframe
            src={info.mapEmbedUrl}
            title="Hotel Thakali Inn on Google Maps"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <figcaption>
            <button type="button" className="con-code" onClick={copyPlusCode}>
              {copied ? "Copied" : info.plusCode}
            </button>
            <a
              className="con-directions"
              href={info.directionsUrl}
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
              Message sent. We reply from {info.email}, usually within a day — call {info.phone}{" "}
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

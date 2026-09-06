"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TZ } from "@/lib/live";

/* The same four-state submit pattern as ContactPanel — FormData →
   Object.fromEntries → fetch → { ok, error }. The endpoint is the guard;
   the browser's native date/number controls are the courtesy check. */

type Status = "idle" | "sending" | "sent" | "error";

export type RoomOption = { slug: string; name: string; capacity: string };

export default function BookingForm({
  rooms,
  bookingUrl,
  phone,
}: {
  rooms: RoomOption[];
  bookingUrl: string;
  phone: string;
}) {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [checkIn, setCheckIn] = useState("");

  /* Today in Kathmandu, not the guest's timezone — same en-CA trick as the
     endpoint, so the strings the two compare are the same shape. */
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

  /* One calendar day after an "YYYY-MM-DD" string. The endpoint requires at
     least one night (departure strictly after arrival) — this is what makes
     the date picker refuse the same mistake instead of the guest finding out
     after submit. */
  const dayAfter = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  /* ?room= carries a slug (the carousel links use it); the select's values are
     room titles, so the match has to go through the slug. */
  const wanted = rooms.find((r) => r.slug === params.get("room"))?.name ?? rooms[0]?.name;

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("sending");
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      /* Same cast as ContactPanel: Workers types make json() unknown, which is
         correct — this is a response from the network, not a trusted value. */
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "That did not send.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send.");
      setStatus("error");
    }
  }

  return (
    <div className="bk-page">
      <section className="bk-card">
        <span className="bk-eyebrow">Book direct</span>
        <h1>Request a room</h1>
        <p className="bk-blurb">We reply by email to confirm. Nothing is charged here.</p>

        {status === "sent" ? (
          <p className="bk-sent" role="status">
            Request sent. We reply by email, usually within a day — call {phone} if it is urgent.
          </p>
        ) : (
          <form className="bk-form" onSubmit={send}>
            {/* Same trap as the contact form: bots fill every field they find,
                guests never see this one. */}
            <input
              className="con-trap"
              type="text"
              name="note_ref"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <label className="bk-field">
              <span>Arrival</span>
              <input
                name="check_in"
                type="date"
                required
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="bk-field">
              <span>Departure</span>
              <input name="check_out" type="date" required min={dayAfter(checkIn || today)} />
            </label>
            <label className="bk-field">
              <span>Room</span>
              <select name="room" required defaultValue={wanted}>
                {rooms.map((r) => (
                  <option key={r.slug} value={r.name}>
                    {r.name} · {r.capacity}
                  </option>
                ))}
              </select>
            </label>
            <label className="bk-field">
              <span>Guests</span>
              <input name="guests" type="number" required min={1} max={10} defaultValue={2} />
            </label>
            <label className="bk-field">
              <span>Name</span>
              <input name="name" type="text" required maxLength={80} autoComplete="name" />
            </label>
            <label className="bk-field">
              <span>Email</span>
              <input name="email" type="email" required maxLength={160} autoComplete="email" />
            </label>
            <label className="bk-field bk-field-wide">
              <span>Phone (optional)</span>
              <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
            </label>
            <label className="bk-field bk-field-wide">
              <span>Anything we should know</span>
              <textarea name="notes" maxLength={1000} rows={3} placeholder="Late arrival, extra bed, quiet room…" />
            </label>

            <div className="bk-actions">
              {status === "error" && (
                <p className="bk-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="bk-send" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Request this room"}
              </button>
              {/* Instant confirmation stays one click away. This form is for the
                  guests who would rather ask than commit. */}
              <a className="bk-ota" href={bookingUrl} target="_blank" rel="noopener noreferrer">
                Prefer instant confirmation? Book on Booking.com →
              </a>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

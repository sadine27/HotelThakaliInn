import { env } from "cloudflare:workers";
import { settings } from "@/lib/content";
import { TZ } from "@/lib/live";

/* Route handlers are never prerendered, but the constraint is absolute: any
   file touching a binding declares it as a literal. */
export const dynamic = "force-dynamic";

const FROM = "notify@hotelthakaliinn.com";
const FALLBACK_TO = "hotelthakaliinn1@gmail.com";
const LIMITS = { name: 80, email: 160, phone: 40, room: 60, notes: 1000 } as const;
const MAX_NIGHTS = 30;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/* Today in Kathmandu, not in the guest's timezone. en-CA formats as YYYY-MM-DD,
   which is why these dates can be compared as plain strings — no Date parsing,
   no UTC+5:45 arithmetic to get wrong. */
const todayKtm = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* The regex only checks the shape — 2026-13-45 is shaped right and wrong on
   every axis, and a bogus date also makes nights() return NaN, which slips
   past both comparisons below. Parsing it as an ISO day and round-tripping it
   back catches any day the calendar does not actually contain. */
const realDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

const nights = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  /* Honeypot, same shape as the contact form: a real guest never sees this
     field, so anything in it is a bot — answered with a success it cannot
     distinguish from the real one. */
  if (clean(body.website, 200)) return Response.json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const phone = clean(body.phone, LIMITS.phone);
  const room = clean(body.room, LIMITS.room);
  const notes = clean(body.notes, LIMITS.notes);
  const checkIn = clean(body.check_in, 10);
  const checkOut = clean(body.check_out, 10);
  const guests = Number(body.guests);

  if (!name || !room || !/^[^\s@?&#%,;<>"']+@[^\s@?&#%,;<>"']+\.[^\s@?&#%,;<>"']+$/.test(email)) {
    return Response.json(
      { ok: false, error: "Please fill in your name, a valid email and a room." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
    return Response.json({ ok: false, error: "How many guests?" }, { status: 400 });
  }
  if (!ISO.test(checkIn) || !ISO.test(checkOut) || !realDay(checkIn) || !realDay(checkOut) || checkIn < todayKtm()) {
    return Response.json({ ok: false, error: "Please choose arrival and departure dates." }, { status: 400 });
  }
  const stay = nights(checkIn, checkOut);
  if (stay < 1 || stay > MAX_NIGHTS) {
    return Response.json(
      { ok: false, error: `Departure must be after arrival, and at most ${MAX_NIGHTS} nights.` },
      { status: 400 },
    );
  }

  try {
    await env.DB.prepare(
      "INSERT INTO booking_requests (name, email, phone, room, guests, check_in, check_out, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
      .bind(name, email, phone, room, guests, checkIn, checkOut, notes)
      .run();
  } catch (err) {
    console.error("[booking] D1 insert failed", err);
    return Response.json({ ok: false, error: "That did not send." }, { status: 500 });
  }

  /* Best effort and after the insert, for the same reason as the contact form: a
     mail outage costs a notification, never the request. This one matters more —
     a booking request nobody reads is a room sold through Booking.com instead. */
  try {
    const to = (await settings()).email || FALLBACK_TO;
    await env.EMAIL.send({
      to,
      from: { email: FROM, name: "Thakali Inn website" },
      replyTo: email,
      /* Untrusted input in a header: a newline would let the guest append
         headers of their own. */
      subject: `Booking request — ${checkIn} to ${checkOut}, ${name.replace(/[\r\n]+/g, " ")}`,
      text: `${name} <${email}>${phone ? ` · ${phone}` : ""}\n\n${room}\n${guests} guest${guests > 1 ? "s" : ""}\n${checkIn} → ${checkOut} (${stay} night${stay > 1 ? "s" : ""})\n\n${notes}\n`,
    });
  } catch (err) {
    console.error("[booking] notify failed", err);
  }

  return Response.json({ ok: true });
}

/* The contact form's endpoint. Validates, archives to D1 (env.DB, the `messages`
 * table from migrations/0001_messages.sql), then notifies the hotel by mail. The
 * archive write is the part that must not be lost, so it lands first and the mail
 * can fail without costing an enquiry. */
import { env } from "cloudflare:workers";
import { settings } from "@/lib/content";

/* Route handlers are never prerendered, but the constraint is absolute: any
   file touching a binding declares it as a literal. */
export const dynamic = "force-dynamic";

/* Must be on hotelthakaliinn.com — Email Sending will only accept a `from` on a
   domain onboarded to this account — and must match the `allowed_sender_addresses`
   pin in wrangler.jsonc. */
const FROM = "notify@hotelthakaliinn.com";
/* Used when the `email` settings row is missing. The address is pinned in
   wrangler.jsonc too, so this is the only recipient the binding can reach. */
const FALLBACK_TO = "hotelthakaliinn1@gmail.com";

/* Caps, not just presence checks: this endpoint will be public and unauthenticated,
   and an unbounded body becomes an unbounded D1 row the moment the insert exists. */
const LIMITS = { name: 80, email: 160, message: 2000 } as const;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  /* Honeypot. A real guest never sees this field, so anything in it is a bot —
     answered with a success it can't distinguish from the real one, because a 400
     tells the author which check to route around next time. */
  if (clean(body.website, 200)) {
    return Response.json({ ok: true });
  }

  /* CF-Connecting-IP is set by the edge and cannot be spoofed by the client. */
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.FORM_IP.limit({ key: ip });
  if (!success) return Response.json({ ok: false, error: "Too many requests." }, { status: 429 });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);

  /* Deliberately not an RFC-5322 regex: the only question worth asking here is
     whether a reply could plausibly be addressed, and the real check is that the
     guest reads what they typed. Anything stricter rejects valid addresses.

     The excluded set is wider than whitespace, though, because this string ends
     up inside a `mailto:` href in the staff inbox and in a `replyTo` on the
     notification. ? & # % , ; and quotes are what turn a mailto into a composer
     with someone else's subject, body and bcc — and none of them are legal in an
     unquoted address anyway, so nothing real is turned away. */
  if (!name || !message || !/^[^\s@?&#%,;<>"']+@[^\s@?&#%,;<>"']+\.[^\s@?&#%,;<>"']+$/.test(email)) {
    return Response.json(
      { ok: false, error: "Please fill in your name, a valid email, and a message." },
      { status: 400 },
    );
  }

  try {
    await env.DB.prepare(
      "INSERT INTO messages (name, email, message) VALUES (?, ?, ?)",
    )
      .bind(name, email, message)
      .run();
  } catch (err) {
    console.error("[contact] D1 insert failed", err);
    return Response.json({ ok: false, error: "That did not send." }, { status: 500 });
  }

  /* Best effort, and after the insert on purpose: a mail outage costs a
     notification, never the enquiry itself. Awaited rather than fired and
     forgotten because a Worker stops executing the moment the response returns —
     the extra ~100ms is what makes "sent" mean somebody was actually told. */
  try {
    const to = (await settings()).email || FALLBACK_TO;
    await env.EMAIL.send({
      to,
      from: { email: FROM, name: "Thakali Inn website" },
      /* So the hotel just hits reply and it reaches the guest, rather than a
         no-reply mailbox nobody watches. */
      replyTo: email,
      /* The guest's name is untrusted and goes into a header: a newline in it
         would otherwise let them append headers of their own. */
      subject: `Website enquiry — ${name.replace(/[\r\n]+/g, " ")}`,
      /* Plain text only. There is nothing here to lay out, and a text-only
         transactional mail scores better with spam filters than a styled one. */
      text: `${name} <${email}>\n\n${message}\n`,
    });
  } catch (err) {
    console.error("[contact] notify failed", err);
  }

  return Response.json({ ok: true });
}

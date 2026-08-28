/* The contact form's endpoint.
 *
 * INCOMPLETE ON PURPOSE: today this validates a message and drops it. The D1
 * insert and the mail to hotelthakaliinn1@gmail.com are the next task, and they
 * go in the marked spot below — the site is not on Cloudflare yet, so there is
 * no binding to write to. Nothing is deployed (no wrangler.jsonc, no CI), so no
 * guest can reach this yet. DO NOT DEPLOY /contact UNTIL THAT LANDS: a form that
 * accepts a message and discards it is worse than no form.
 */

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

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);

  /* Deliberately not an RFC-5322 regex: the only question worth asking here is
     whether a reply could plausibly be addressed, and the real check is that the
     guest reads what they typed. Anything stricter rejects valid addresses. */
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { ok: false, error: "Please fill in your name, a valid email, and a message." },
      { status: 400 },
    );
  }

  // TODO(d1): env.DB.prepare("INSERT INTO messages …").bind(…).run()
  //           then send the notification to EMAIL. Both go here, in this order:
  //           the archive write is what must not be lost, the mail is best-effort.
  console.log("[contact]", { name, email, message });

  return Response.json({ ok: true });
}

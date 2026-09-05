/* The system check, as JSON, for the nightly worker to press.
 *
 * The board at /admin/check is the same run behind a session; this is the same
 * run behind a shared token, because a cron has no cookie. It is the only way
 * in that is not a signed-in person, so it is narrow on purpose: one header,
 * compared in constant time, and nothing to read without it.
 */
import { env } from "cloudflare:workers";
import { runChecks } from "@/lib/checks";

export const dynamic = "force-dynamic";

/* Never a hex ===. Comparing secrets with string equality leaks how many
   leading bytes were right, one attempt at a time — same reasoning as the
   session signature check in lib/auth.ts. */
function timingSafeEqual(a: string | null, b: string | undefined): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a ?? "");
  const bufB = enc.encode(b ?? "");
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export async function GET(request: Request) {
  const token = env.CHECK_TOKEN;
  /* No token configured means no door, rather than a door that opens for the
     empty string. */
  if (!token || !timingSafeEqual(request.headers.get("X-Check-Token"), token)) {
    return new Response("not found", { status: 404 });
  }

  const results = await runChecks(new URL(request.url).searchParams.get("full") === "1");
  const failed = results.filter((r) => r.ok === false).length;

  return Response.json(
    { ok: failed === 0, failed, total: results.length, results },
    /* A failing check is a 200 with ok:false, not a 500: the worker reading
       this needs the list, and an error status would hide it behind a retry. */
    { status: 200 },
  );
}

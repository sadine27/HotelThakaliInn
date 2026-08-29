/* One row per page read, and nothing else.
 *
 * This is the whole analytics backend. It stores a path, a referring host and a
 * date. It does not store an IP, a user-agent, a cookie or an id, which means it
 * cannot tell you who anyone is or that two visits were the same person — and
 * that is the deliberate ceiling, not an oversight. "Which pages get read and
 * where from" is the question a hotel actually has.
 */
import { env } from "cloudflare:workers";
import { kathmanduDay } from "@/lib/live";

/* Route handlers are never prerendered, but the constraint is absolute: any
   file touching a binding declares it as a literal. */
export const dynamic = "force-dynamic";

/* The shape of every real route on this site: a slash, then lowercase letters,
   digits and dashes. An allowlist of the six pages would have to be edited every
   time a page is added; this never does, and still refuses the query strings,
   fragments and encoded junk a script would use to make the table useless. */
const PATH = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

/* Not a defence — anything can claim to be a browser — just a broom. These are
   the crawlers that run JavaScript and would otherwise be most of the numbers. */
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|python|axios|node-fetch/i;

export async function POST(request: Request) {
  if (BOT.test(request.headers.get("User-Agent") ?? "")) {
    return new Response(null, { status: 204 });
  }

  /* CF-Connecting-IP is set by the edge and cannot be spoofed by the client.
     Used as a rate-limit key and then dropped — it is never written anywhere. */
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.VIEW_IP.limit({ key: ip });
  if (!success) return new Response(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown };
  try {
    body = (await request.json()) as { path?: unknown; referrer?: unknown };
  } catch {
    return new Response(null, { status: 204 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 64) : "";
  /* /admin is staff looking at their own site, and counting it would drown the
     six real pages in the noise of whoever is editing them. */
  if (!PATH.test(path) || path.startsWith("/admin") || path.startsWith("/api")) {
    return new Response(null, { status: 204 });
  }

  /* Host only, and only if it parses as a URL and is not us. Our own pages
     referring to each other is navigation, not a source. */
  let referrer = "";
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      const host = new URL(body.referrer).hostname.replace(/^www\./, "");
      if (host !== new URL(request.url).hostname.replace(/^www\./, "")) {
        referrer = host.slice(0, 100);
      }
    } catch {
      /* Not a URL. Then it is not a referrer we can name, so it stays empty. */
    }
  }

  try {
    await env.DB.prepare("INSERT INTO page_views (path, referrer, day) VALUES (?1, ?2, ?3)")
      .bind(path, referrer, kathmanduDay())
      .run();
  } catch (err) {
    /* A lost count is not worth a console error in a guest's browser, and this
       endpoint must never be able to make a page look broken. */
    console.error("[view] insert failed", err);
  }

  return new Response(null, { status: 204 });
}

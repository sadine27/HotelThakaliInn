/* One row per page read.
 *
 * It used to store a path, a referring host and a date, and nothing else — no
 * address, no agent, no id — which meant it could not tell you how many
 * different people came, whether any of them came back, or where in the world
 * they were. Those were never turned off; they had never been written down.
 *
 * They are now, deliberately and with the owner's decision on record: country,
 * city and network (all of which Cloudflare hands over free on every request),
 * a device and browser family, a stable per-visitor hash, and the address
 * itself. The address is the one field with legal weight — /privacy says it is
 * kept and blanked after a year, only the developer (or an owner holding a
 * 24-hour grant) can reveal one, and every reveal is audited.
 *
 * This endpoint stays silent about everything: success, bot, rate limit, bad
 * JSON, bad path and a failed insert are all a bare 204. A counting endpoint
 * must never be able to make a guest's page look broken, and must never tell a
 * script which of its guesses landed.
 */
import { env } from "cloudflare:workers";
import { kathmanduDay, kathmanduNow } from "@/lib/live";

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

/* Everything Cloudflare knows about where a request came from, without a
   lookup, a cookie or a third party. `request.cf` is the rich version and is
   present on a real edge request; under some local adapters it is not, so the
   country falls back to the header, which is always set. Anything missing stays
   an empty string rather than a guess — a blank means "we do not know", and a
   panel that says "Unknown" is honest where "United States" would not be. */
type Geo = { country: string; city: string; region: string; network: string };

function geoOf(request: Request): Geo {
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  return {
    country: clip(cf?.country ?? request.headers.get("CF-IPCountry"), 2),
    city: clip(cf?.city, 60),
    region: clip(cf?.region, 60),
    network: clip(cf?.asOrganization, 80),
  };
}

/* Family, not fingerprint. "phone / Chrome" is what a hotel can act on — it
   tells the owner whether to care about the mobile layout. A full user-agent
   string would be a far better identifier and a far worse answer. */
function deviceOf(ua: string): { device: string; browser: string } {
  const device = /iPad|Tablet/i.test(ua)
    ? "tablet"
    : /Mobi|Android|iPhone/i.test(ua)
      ? "phone"
      : "desktop";
  /* Order matters: Edge and Opera both claim Chrome, and Chrome claims Safari. */
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /SamsungBrowser/i.test(ua)
        ? "Samsung"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Chrome\//i.test(ua)
            ? "Chrome"
            : /Safari\//i.test(ua)
              ? "Safari"
              : "";
  return { device, browser };
}

/* A stable short id for one address-and-browser pair. Not a privacy measure —
   the address sits in the next column — it is what makes "how many different
   people", "did anyone come back" and "Home then Rooms then Contact"
   expressible at all, where before a refresh was simply two visits.
 *
 * Keyed on SESSION_SECRET so the ids cannot be recomputed by anyone holding a
 * copy of the table alone, and truncated to 12 hex characters: enough that two
 * visitors colliding is not a thing that will happen here, short enough to
 * print in a list. */
async function visitorId(ip: string, ua: string): Promise<string> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ip}|${ua}`));
    return [...new Uint8Array(sig)]
      .slice(0, 6)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    /* No id is better than a wrong one: an empty visitor simply does not join
       up with anything, rather than joining up with the wrong person. */
    return "";
  }
}

export async function POST(request: Request) {
  const ua = request.headers.get("User-Agent") ?? "";
  if (BOT.test(ua)) return new Response(null, { status: 204 });

  /* CF-Connecting-IP is set by the edge and cannot be spoofed by the client. */
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const { success } = await env.VIEW_IP.limit({ key: ip || "unknown" });
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

  const geo = geoOf(request);
  const { device, browser } = deviceOf(ua);
  const visitor = await visitorId(ip, ua);

  try {
    await env.DB.prepare(
      `INSERT INTO page_views
         (path, referrer, day, country, city, region, network, device, browser, visitor, ip, at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
      .bind(
        path,
        referrer,
        kathmanduDay(),
        geo.country,
        geo.city,
        geo.region,
        geo.network,
        device,
        browser,
        visitor,
        ip,
        kathmanduNow(),
      )
      .run();
  } catch (err) {
    /* A lost count is not worth a console error in a guest's browser, and this
       endpoint must never be able to make a page look broken. */
    console.error("[view] insert failed", err);
  }

  return new Response(null, { status: 204 });
}

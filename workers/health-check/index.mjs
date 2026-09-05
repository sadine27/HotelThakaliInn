/* The nightly proof that the site still works, and the yearly forgetting of
 * visitor addresses.
 *
 * A separate worker, following the audit-archiver and r2-backup pattern in this
 * directory: a scheduled handler inside the vinext build is awkward, and this
 * has to keep running even if a deploy of the main worker is broken — which is
 * exactly the night you want to be told.
 *
 * It also opens every public page itself. That check cannot live inside
 * lib/checks.ts, because a worker fetching its own hostname is not the request
 * a guest makes; from out here it is an ordinary one. In the daytime the same
 * list is walked by the browser on /admin/check.
 *
 * It presses the same button a person would. /api/check runs lib/checks.ts in
 * the live worker, including the write checks and a real test email, and hands
 * back JSON. This worker reads that and stays silent unless something is red:
 * a nightly "everything is fine" email is a nightly email that stops being
 * read, and then the one that matters is not read either.
 */

import { PUBLIC_ROUTES, PAGE_MUST_CONTAIN } from "../../lib/public-routes.ts";

const SITE = "https://hotelthakaliinn.com";
const FROM = "notify@hotelthakaliinn.com";
/* The one address wrangler.jsonc permits, hardcoded for the same reason
   lib/audit.ts hardcodes it: an alert must not be silenceable by editing a
   settings row. */
const ALERT_TO = "hotelthakaliinn1@gmail.com";

async function runChecks(env) {
  const res = await fetch(`${SITE}/api/check?full=1`, {
    headers: { "X-Check-Token": env.CHECK_TOKEN, "User-Agent": "thakali-inn-nightly" },
  });
  if (!res.ok) {
    /* The endpoint itself being unreachable IS the failure, and the loudest
       one — it means the site is down or the token no longer matches. */
    return {
      failed: [
        {
          name: "The site itself",
          detail: `/api/check answered ${res.status}`,
          where: "the deploy, or CHECK_TOKEN",
        },
        ...(await checkPublicPages()),
      ],
      total: 2,
    };
  }
  const body = await res.json();
  const pages = await checkPublicPages();
  return {
    failed: [...body.results.filter((r) => r.ok === false), ...pages],
    total: body.results.length + 1,
  };
}

/* A 200 only proves the worker answered; the phrase proves the page rendered
   its data. One failed row for the lot — eight red lines in an email is a wall,
   one line naming the broken routes is a message. */
async function checkPublicPages() {
  const bad = [];
  for (const route of PUBLIC_ROUTES) {
    try {
      const res = await fetch(`${SITE}${route}?selfcheck=${Date.now()}`, {
        headers: { "User-Agent": "thakali-inn-nightly", "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        bad.push(`${route} → ${res.status}`);
        continue;
      }
      const needle = PAGE_MUST_CONTAIN[route];
      if (needle) {
        if (!(await res.text()).includes(needle)) bad.push(`${route} loaded but has no “${needle}”`);
      } else {
        await res.body?.cancel();
      }
    } catch (e) {
      bad.push(`${route} → ${String(e).slice(0, 80)}`);
    }
  }
  return bad.length ? [{ name: "Public pages", detail: bad.join("; "), where: "app/" }] : [];
}

/* Addresses are kept for a year, as /privacy says. Everything else — the
   country, the counts, the journeys — outlives them: blanking the column
   leaves the row and its history intact. */
async function forgetOldAddresses(env) {
  const { meta } = await env.DB.prepare(
    "UPDATE page_views SET ip = '' WHERE ip != '' AND day < date('now', '-1 year')",
  ).run();
  return meta?.changes ?? 0;
}

async function alert(env, failed, forgotten) {
  const lines = failed.map((f) => `  ✗ ${f.name}\n      ${f.detail}\n      → ${f.where ?? ""}`);
  await env.EMAIL.send({
    to: ALERT_TO,
    from: { email: FROM, name: "Thakali Inn system check" },
    subject: `Thakali Inn — ${failed.length} check${failed.length === 1 ? "" : "s"} failed`,
    text:
      `The nightly system check found something wrong.\n\n${lines.join("\n\n")}\n\n` +
      `Open ${SITE}/admin/check to run it again and see the rest.\n` +
      (forgotten ? `\n(${forgotten} visitor addresses older than a year were also deleted tonight.)\n` : ""),
  });
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        /* Retention runs first and unconditionally: it is a promise made on
           /privacy, and it must not be skipped because a check failed. */
        let forgotten = 0;
        try {
          forgotten = await forgetOldAddresses(env);
        } catch (e) {
          console.error("[health] retention failed", e);
        }

        try {
          const { failed, total } = await runChecks(env);
          console.log(`[health] ${total - failed.length}/${total} passed, ${forgotten} addresses forgotten`);
          if (failed.length) await alert(env, failed, forgotten);
        } catch (e) {
          console.error("[health] check run failed", e);
          await alert(
            env,
            [{ name: "The nightly check", detail: String(e).slice(0, 300), where: "workers/health-check" }],
            forgotten,
          ).catch(() => {});
        }
      })(),
    );
  },

  /* Manual trigger, same shape as r2-backup's: the cron is the real path, this
     is for "run it now and tell me". Token-gated and constant-time compared. */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/run") return new Response("not found", { status: 404 });
    if (!timingSafeEqual(request.headers.get("X-Check-Token"), env.CHECK_TOKEN)) {
      return new Response("no", { status: 401 });
    }
    const forgotten = await forgetOldAddresses(env).catch(() => 0);
    const { failed, total } = await runChecks(env);
    if (failed.length) await alert(env, failed, forgotten);
    return Response.json({ passed: total - failed.length, total, failed, forgotten });
  },
};

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a ?? "");
  const bufB = enc.encode(b ?? "");
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

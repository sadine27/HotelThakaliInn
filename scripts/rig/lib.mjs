/* The browser rig, shared.
 *
 * Every phase of this rebuild has driven the admin with Playwright, and every
 * phase has rebuilt this file from scratch in a temp folder — the same cookie
 * mint, the same two route aborts, the same assert helper, rediscovered each
 * time including the wrangler crash they work around. It lives here now. A
 * phase script is the assertions and nothing else.
 *
 *   node scripts/rig/<phase>.mjs            # signed in as developer
 *   node scripts/rig/<phase>.mjs staff      # as somebody else
 *
 * It needs `npm run start` already serving on :8787 and the local D1 migrated.
 * It is not part of `npm run check`: that runs in seconds with no server, and
 * this needs one.
 */

import { chromium } from "playwright-core";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const BASE = "http://127.0.0.1:8787";

/* The same HMAC the worker checks: `user|expiry` and its digest. Twelve hours
   is long enough that a slow run never expires mid-way and short enough that a
   cookie left in a shell's history is useless tomorrow. */
export function mint(user = "developer") {
  const secret = readFileSync(".dev.vars", "utf8").match(
    /^SESSION_SECRET\s*=\s*"?([^"\r\n]+)"?/m,
  )[1];
  const payload = `${user}|${Math.floor(Date.now() / 1000) + 43200}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

/* Playwright's own download, found the way `npx playwright install` leaves it.
   playwright-core ships no browser of its own on purpose — this repo would
   otherwise carry 150 MB it never deploys. */
const EXE = path.join(
  os.homedir(),
  "AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe",
);

export async function open({ user = "developer", width = 1280, height = 950 } = {}) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([
    { name: "ti_admin", value: mint(user), domain: "127.0.0.1", path: "/", httpOnly: true },
  ]);
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  /* Two requests that take the dev server down rather than fail:
     - /_next/image: wrangler dev's proxy on Windows dies on it, an empty
       [ERROR] and the port goes away mid-run.
     - /api/view: a keepalive POST fired as the page navigates away, and
       wrangler's loopback service takes the whole server down when one is in
       flight at that moment.
     Neither is ever what a phase is testing, so neither is ever asked for. */
  await page.route("**/_next/image*", (r) => r.abort());
  await page.route("**/api/view", (r) => r.abort());

  const ok = [];
  const bad = [];
  /* One assert, named in the words the check would be reported in. `extra` is
     what it actually saw — a failure with no observed value is a failure you
     have to reproduce before you can read it. */
  const t = (name, cond, extra = "") => (cond ? ok : bad).push(`${name}${extra ? ` — ${extra}` : ""}`);

  /* Called last. Fails the run on a page error too: an exception thrown in a
     server component renders an empty section rather than a crash, so every
     assertion around it can pass while the screen is broken. */
  async function report() {
    t("no page errors", errors.length === 0, errors.join("; "));
    await browser.close();
    console.log("PASS:");
    for (const l of ok) console.log("  ok   " + l);
    if (bad.length) {
      console.log("FAIL:");
      for (const l of bad) console.log("  BAD  " + l);
    }
    console.log(`${ok.length}/${ok.length + bad.length}`);
    process.exit(bad.length ? 1 : 0);
  }

  return { browser, ctx, page, errors, t, report };
}

/* Capture the exact POST a form sends, without letting it land, then replay it
   from somebody else's session. This is the only way to check the thing that
   actually enforces a permission: the re-check inside the server action, not
   whether a button was drawn. A hand-built body would not do — a server action
   is addressed by an id the client bundle generates, so the browser has to
   produce the request and the test has to steal it. */
export async function capture(page, urlGlob, trigger) {
  let got = null;
  await page.route(urlGlob, async (route, req) => {
    if (req.method() === "POST" && !got) {
      got = { url: req.url(), body: req.postDataBuffer(), headers: req.headers() };
      await route.abort();
      return;
    }
    await route.continue();
  });
  await trigger().catch(() => {});
  await page.waitForTimeout(1500);
  await page.unroute(urlGlob);
  return got;
}

/* Sent with a different session cookie and nothing else changed. `redirect:
   "manual"` because a refused action answers with a redirect to the error
   notice, and following it would report the notice page's 200. Every header
   comes back, not just Location: a server action's redirect travels in
   `x-action-redirect` and leaves Location empty, so a caller reading only
   Location sees a bare 303 and cannot tell a refusal from a success. */
export async function replay(captured, user) {
  const headers = { ...captured.headers };
  for (const k of ["cookie", "host", "content-length", "connection"]) delete headers[k];
  headers.cookie = `ti_admin=${mint(user)}`;
  const res = await fetch(captured.url, {
    method: "POST",
    redirect: "manual",
    headers,
    body: captured.body,
  });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text: await res.text() };
}

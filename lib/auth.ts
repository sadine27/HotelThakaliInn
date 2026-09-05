/* Individual admin accounts, not one shared password: the cookie carries a
 * verified username so every write can be attributed to a real actor in the
 * audit log (lib/audit.ts). Still no session store — the cookie is the only
 * state, HMAC-signed so nothing in it can be forged without SESSION_SECRET.
 * Signing out is local: the cookie is deleted, not revoked.
 *
 * Who is allowed to hold a session at all is decided by lib/google-auth.ts —
 * a session only ever starts for an email already present in admin_users. */
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const NAME = "ti_admin";
const TTL = 43_200; // 12 hours, in seconds — one shift
const STATE_NAME = "ti_oauth_state";
const STATE_TTL = 300; // 5 minutes — long enough for the Google redirect round-trip
const enc = new TextEncoder();

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (p) => parseInt(p, 16));

/* Imported once per isolate rather than once per request. The key is not
   extractable, so it never leaves the Worker even in a heap dump. */
let signer: Promise<CryptoKey> | null = null;
const hmac = () =>
  (signer ??= crypto.subtle.importKey(
    "raw",
    enc.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  ));

const sign = async (payload: string) => hex(await crypto.subtle.sign("HMAC", await hmac(), enc.encode(payload)));

/* Usernames are the payload now, not just an expiry — but they still have to
   round-trip through one cookie value un-ambiguously, so "." is rejected at
   account-creation time and "|" separates the fields here since neither a
   username nor a base-10 timestamp can contain it. */
const pack = (username: string, exp: string) => `${username}|${exp}`;

export async function startSession(username: string) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  const payload = pack(username, exp);
  const sig = await sign(payload);
  /* Path=/admin means this cookie is never sent on a guest request, so it can
     never vary a cached public response. That is also why every admin write has
     to live under /admin — one path scope covers all of them. */
  (await cookies()).set(NAME, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    /* Lax, not Strict: this cookie is set mid-redirect-chain (Google ->
       callback -> /admin), and browsers still treat that whole chain as
       cross-site — from Google — until a page actually commits. A Strict
       cookie set on the callback response gets silently dropped on the very
       next hop of that same chain, which is exactly why login looked like it
       silently failed. Lax still blocks the cookie from any real
       cross-site/subresource request; it only allows top-level GET
       navigation, which is all a redirect chain like this is. */
    sameSite: "lax",
    path: "/admin",
    maxAge: TTL,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: NAME, path: "/admin" });
}

/* Verifies the cookie and returns the signed-in username, or null. The single
   source of truth every other auth check in this file is built from. Only
   checks the signature and expiry — whether the account still exists is
   requireSession()'s job, since that needs a DB round trip this helper
   shouldn't force on every caller (e.g. hasSession() for cheap UI checks). */
async function verify(): Promise<string | null> {
  const token = (await cookies()).get(NAME)?.value;
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const pipeIdx = payload.indexOf("|");
  if (pipeIdx < 0) return null;
  const username = payload.slice(0, pipeIdx);
  const exp = payload.slice(pipeIdx + 1);
  if (!username || !exp) return null;
  /* Checked here as well as by Max-Age, because Max-Age is the browser's promise
     and this is ours. The expiry is inside the signed payload, so editing it
     invalidates the signature. */
  const expMs = Number(exp) * 1000;
  /* Number.isFinite first: a non-numeric expiry yields NaN, and NaN comparisons
     are all false — which would let a malformed token skip the expiry gate. */
  if (!Number.isFinite(expMs) || expMs < Date.now()) return null;
  try {
    /* crypto.subtle.verify, never a hex ===. Comparing signatures with string
       equality leaks how many leading bytes were right, one byte per attempt. */
    const ok = await crypto.subtle.verify("HMAC", await hmac(), unhex(sig), enc.encode(payload));
    return ok ? username : null;
  } catch {
    return null; // malformed hex is a forgery attempt, not an error worth logging
  }
}

export async function hasSession() {
  return (await verify()) !== null;
}

/* Same lookup as requireSession, but it answers "nobody" instead of redirecting.
   For the one caller that has to run before anything is guarded: the admin
   layout, which draws the nav on /admin/login too and must not bounce a person
   away from the page they are trying to sign in on. Never use it as a guard —
   a null here means "not signed in", not "carry on". */
export async function peekSession(): Promise<{ username: string; role: string } | null> {
  const username = await verify();
  if (!username) return null;
  const row = await env.DB.prepare("SELECT role FROM admin_users WHERE username = ?1")
    .bind(username)
    .first<{ role: string }>()
    .catch(() => null);
  return row ? { username, role: row.role } : null;
}

/* The username of the signed-in account, for attribution in the audit log.
   Only ever called after requireSession() has already run, so a null here
   would mean the caller skipped that guard — callers should not need to
   handle it, but the type stays honest about the signature check underneath. */
export async function getActor(): Promise<string> {
  const username = await verify();
  if (!username) redirect("/admin/login");
  return username;
}

/* The first line of every admin page and every Server Action. Server Actions do
   not run layouts — a guard in app/admin/layout.tsx would protect the HTML and
   none of the writes. One rule, no exceptions: requireSession() first.

   Also closes the revocation gap a stateless cookie otherwise has: deleting a
   row from admin_users (e.g. someone leaves) would not by itself invalidate a
   cookie already issued to them — the signature would still verify and the
   expiry hasn't passed. So this looks the username up on every call and
   treats a missing row exactly like an expired session, not just at login
   time. The same query hands back `role`, so callers that need it (the
   accounts page) don't need a second round trip. */
export async function requireSession(): Promise<{ username: string; role: string }> {
  const username = await verify();
  if (!username) redirect("/admin/login");
  const row = await env.DB.prepare("SELECT role FROM admin_users WHERE username = ?1")
    .bind(username)
    .first<{ role: string }>();
  if (!row) redirect("/admin/login");
  return { username, role: row.role };
}

/* CSRF guard for the Google OAuth round trip: a random value is stashed here
   before redirecting to Google, and the callback must see the same value come
   back in the `state` query param. Short TTL because the whole trip is one
   user-driven redirect, not a session. */
export async function setOAuthState(state: string) {
  const exp = String(Math.floor(Date.now() / 1000) + STATE_TTL);
  const payload = `${state}|${exp}`;
  const sig = await sign(payload);
  (await cookies()).set(STATE_NAME, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // Google's redirect back is a top-level cross-site GET; Strict would drop the cookie
    path: "/admin/auth/google",
    maxAge: STATE_TTL,
  });
}

export async function consumeOAuthState(expected: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(STATE_NAME)?.value;
  jar.delete({ name: STATE_NAME, path: "/admin/auth/google" });
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const pipeIdx = payload.indexOf("|");
  if (pipeIdx < 0) return false;
  const state = payload.slice(0, pipeIdx);
  const exp = payload.slice(pipeIdx + 1);
  const expMs = Number(exp) * 1000;
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmac(), unhex(sig), enc.encode(payload));
    return ok && state === expected;
  } catch {
    return false;
  }
}

/* Individual admin accounts, not one shared password: the cookie now carries a
 * verified username so every write can be attributed to a real actor in the
 * audit log (lib/audit.ts). Still no session store — the cookie is the only
 * state, HMAC-signed so nothing in it can be forged without SESSION_SECRET.
 * Signing out is local: the cookie is deleted, not revoked. */
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const NAME = "ti_admin";
const TTL = 43_200; // 12 hours, in seconds — one shift
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

/* Usernames are the payload now, not just an expiry — but they still have to
   round-trip through one cookie value un-ambiguously, so "." is rejected at
   account-creation time (there is none, today) and "|" separates the fields
   here since neither a username nor a base-10 timestamp can contain it. */
const pack = (username: string, exp: string) => `${username}|${exp}`;

export async function startSession(username: string) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  const payload = pack(username, exp);
  const sig = hex(await crypto.subtle.sign("HMAC", await hmac(), enc.encode(payload)));
  /* Path=/admin means this cookie is never sent on a guest request, so it can
     never vary a cached public response. That is also why every admin write has
     to live under /admin — one path scope covers all of them. */
  (await cookies()).set(NAME, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: TTL,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: NAME, path: "/admin" });
}

/* Verifies the cookie and returns the signed-in username, or null. The single
   source of truth every other auth check in this file is built from. */
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

   Also enforces the forced-password-change gate: an account seeded with a
   temporary password cannot reach any other admin page or action until it
   sets a real one, so a leaked temp password is dead the first time its real
   owner logs in. /admin/change-password itself is exempt (it calls
   requireSession() too, but must not redirect back to itself). */
export async function requireSession(opts?: { skipPasswordGate?: boolean }) {
  const username = await verify();
  if (!username) redirect("/admin/login");
  if (opts?.skipPasswordGate) return;
  const row = await env.DB.prepare(
    "SELECT must_change_password FROM admin_users WHERE username = ?1",
  )
    .bind(username)
    .first<{ must_change_password: number }>();
  /* No matching row (account deleted since the cookie was issued) is treated
     the same as an expired session — back to login, not through the gate. */
  if (!row) redirect("/admin/login");
  if (row.must_change_password) redirect("/admin/change-password");
}

export async function checkPassword(username: string, password: string) {
  const row = await env.DB.prepare(
    "SELECT password_hash FROM admin_users WHERE username = ?1",
  )
    .bind(username)
    .first<{ password_hash: string }>();
  if (!row) return false;
  const [saltHex, wantHex] = row.password_hash.split(".");
  if (!saltHex || !wantHex) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unhex(saltHex), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  const got = new Uint8Array(bits);
  const want = unhex(wantHex);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0; // constant time — an early return on the first mismatch times the guess
}

/* PBKDF2-hashes a new password in the exact salt.hash format checkPassword()
   verifies, and clears must_change_password. Called only from
   /admin/change-password's own Server Action, after requireSession() there
   has already proven who is asking. */
export async function setPassword(username: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  const hash = `${hex(salt.buffer)}.${hex(bits)}`;
  await env.DB.prepare(
    "UPDATE admin_users SET password_hash = ?2, must_change_password = 0 WHERE username = ?1",
  )
    .bind(username, hash)
    .run();
}

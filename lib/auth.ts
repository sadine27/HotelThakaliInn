/* The whole auth system. One shared password, one role, about three people — so
 * an auth SaaS would buy a dependency, a bill and an external outage surface in
 * place of this file.
 *
 * The cookie carries only an expiry and its HMAC. There is no session store to
 * keep, nothing in it identifies anyone, and nothing in it is worth forging
 * without the secret. Signing out is therefore local: the cookie is deleted, not
 * revoked. For three staff on a shared password that is the right trade. */
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

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  const sig = hex(await crypto.subtle.sign("HMAC", await hmac(), enc.encode(exp)));
  /* Path=/admin means this cookie is never sent on a guest request, so it can
     never vary a cached public response. That is also why every admin write has
     to live under /admin — one path scope covers all of them. */
  (await cookies()).set(NAME, `${exp}.${sig}`, {
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

export async function hasSession() {
  const token = (await cookies()).get(NAME)?.value;
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  /* Checked here as well as by Max-Age, because Max-Age is the browser's promise
     and this is ours. The expiry is inside the signed payload, so editing it
     invalidates the signature. */
  if (Number(exp) * 1000 < Date.now()) return false;
  try {
    /* crypto.subtle.verify, never a hex ===. Comparing signatures with string
       equality leaks how many leading bytes were right, one byte per attempt. */
    return await crypto.subtle.verify("HMAC", await hmac(), unhex(sig), enc.encode(exp));
  } catch {
    return false; // malformed hex is a forgery attempt, not an error worth logging
  }
}

/* The first line of every admin page and every Server Action. Server Actions do
   not run layouts — a guard in app/admin/layout.tsx would protect the HTML and
   none of the writes. One rule, no exceptions: requireSession() first. */
export async function requireSession() {
  if (!(await hasSession())) redirect("/admin/login");
}

export async function checkPassword(password: string) {
  const [saltHex, wantHex] = (env.ADMIN_PASSWORD_HASH ?? "").split(".");
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

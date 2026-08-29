/* node scripts/hash-password.mjs "the password"
 *
 * Prints "<saltHex>.<hashHex>" to paste into `wrangler secret put ADMIN_PASSWORD_HASH`.
 * Run once, locally. Nothing imports this and it is never deployed.
 *
 * The PBKDF2 parameters here and in lib/auth.ts are one setting in two files:
 * change the iteration count or the hash in either and every existing password
 * stops verifying. If you ever raise them, re-run this and set the secret again. */
const password = process.argv[2];
if (!password) {
  console.error('usage: node scripts/hash-password.mjs "password"');
  process.exit(1);
}

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
  "deriveBits",
]);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
  key,
  256,
);

const hex = (b) => [...new Uint8Array(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
console.log(`${hex(salt)}.${hex(bits)}`);

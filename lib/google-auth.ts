/* Everything specific to "prove this request came from a real Google account
 * with this email" — kept separate from lib/auth.ts, which only knows about
 * this site's own session cookie once an email has been proven. Whitelisting
 * happens one layer up, in the callback route: this file only ever answers
 * "what verified email did Google hand back", never "is that email allowed
 * in" — admin_users is the whitelist, looked up by the caller. */
import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { normalizeEmail } from "./site";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleAuthUrl(redirectUri: string, state: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account"); // never silently reuse whatever Google account is already signed in
  return url.toString();
}

/* Exchanges an authorization code for a verified email, or throws. Verifies
   the ID token's signature against Google's own published keys (jose fetches
   and caches the JWKS itself) rather than trusting the token endpoint's TLS
   alone — the token endpoint response is JSON we parse, not a channel whose
   authenticity implies the JWT inside it is intact. */
export async function verifyGoogleCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const { id_token } = await res.json<{ id_token?: string }>();
  if (!id_token) throw new Error("google token response had no id_token");

  const { payload } = await jwtVerify(id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  const email = payload.email;
  if (typeof email !== "string" || !payload.email_verified) {
    throw new Error("google id_token had no verified email");
  }
  return normalizeEmail(email);
}

import { env } from "cloudflare:workers";
import { consumeOAuthState, startSession } from "@/lib/auth";
import { verifyGoogleCode } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const fail = (request: Request, code: string) =>
  Response.redirect(new URL(`/admin/login?e=${code}`, request.url).toString(), 302);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  /* Same two limiters the password login used, keyed the same way — the
     token exchange below is the expensive step (a real request to Google),
     so it deserves the same brute-force budget a password check did. */
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const [byIp, global] = await Promise.all([
    env.LOGIN_IP.limit({ key: ip }),
    env.LOGIN_ALL.limit({ key: "login" }),
  ]);
  if (!byIp.success || !global.success) return fail(request, "slow");

  if (!code || !state || !(await consumeOAuthState(state))) return fail(request, "state");

  let email: string;
  try {
    const redirectUri = new URL("/admin/auth/google/callback", request.url).toString();
    email = await verifyGoogleCode(code, redirectUri);
  } catch {
    return fail(request, "google");
  }

  const row = await env.DB.prepare("SELECT username FROM admin_users WHERE email = ?1")
    .bind(email)
    .first<{ username: string }>();
  /* No match: say "not authorized", never anything that would confirm or deny
     whether a particular email is in the whitelist. */
  if (!row) return fail(request, "notwhitelisted");

  await startSession(row.username);
  return Response.redirect(new URL("/admin", request.url).toString(), 302);
}

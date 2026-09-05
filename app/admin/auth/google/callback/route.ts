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
  if (!row) {
    /* The user-facing message never confirms or denies whether a particular
       email is whitelisted — but the email Google just verified is proven
       real, so it's safe to record here, where only owner/developer can read
       it, for the one time this rejection is actually a mistake (a row
       stored with a typo, say) rather than an intruder. */
    await env.DB.prepare(
      `INSERT INTO audit_log (actor, action, section, slug, before, after)
       VALUES ('google-oauth', 'admin_login.rejected', NULL, ?1, NULL, NULL)`,
    )
      .bind(email)
      .run();
    return fail(request, "notwhitelisted");
  }

  await startSession(row.username);
  return Response.redirect(new URL("/admin", request.url).toString(), 302);
}

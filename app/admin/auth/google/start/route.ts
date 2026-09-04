import { setOAuthState } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

/* GET, not a Server Action: this has to be a normal top-level navigation so
   Google's own redirect back is a normal top-level navigation too — a
   fetch()-driven flow would have nowhere for that second redirect to land. */
export async function GET(request: Request) {
  const state = crypto.randomUUID();
  await setOAuthState(state);
  const redirectUri = new URL("/admin/auth/google/callback", request.url).toString();
  return Response.redirect(googleAuthUrl(redirectUri, state), 302);
}

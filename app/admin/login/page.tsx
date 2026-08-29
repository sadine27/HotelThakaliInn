import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, startSession } from "@/lib/auth";

/* Same requirement as every other page that touches a binding — see
   app/rooms/page.tsx. On /admin it is also a security control: an admin route the
   prerenderer decides to render gets written into dist/client and served as a
   public static asset. */
export const dynamic = "force-dynamic";

/* The one admin page with no requireSession() in front of it — it is how you get
   one. Everything it can do without a session is: burn a rate-limit token. */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    const head = await headers();

    /* SameSite=Strict already stops a cross-site form from carrying the session
       cookie, but this action runs before there is a session — so the only thing
       standing between another origin and the login endpoint is this. */
    const origin = head.get("Origin");
    if (origin && new URL(origin).host !== head.get("Host")) {
      redirect("/admin/login?e=1");
    }

    /* CF-Connecting-IP is set by the edge and cannot be spoofed by the client;
       X-Forwarded-For can, so it is deliberately not used. Missing only under
       local dev, where every attempt then shares the "unknown" bucket. */
    const ip = head.get("CF-Connecting-IP") ?? "unknown";
    const [byIp, global] = await Promise.all([
      env.LOGIN_IP.limit({ key: ip }),
      env.LOGIN_ALL.limit({ key: "login" }),
    ]);
    if (!byIp.success || !global.success) redirect("/admin/login?e=slow");

    if (!(await checkPassword(String(formData.get("password") ?? "")))) {
      redirect("/admin/login?e=1");
    }

    await startSession();
    redirect("/admin");
  }

  return (
    <form className="adm-login" action={login}>
      <h1>Hotel Thakali Inn</h1>
      <p className="adm-sub">Staff sign in</p>

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
      />

      {e === "slow" && (
        <p className="adm-error" role="alert">
          Too many attempts. Try again in a minute.
        </p>
      )}
      {e === "1" && (
        <p className="adm-error" role="alert">
          That password is not right.
        </p>
      )}

      <button type="submit">Sign in</button>
    </form>
  );
}

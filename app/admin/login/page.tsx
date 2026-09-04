export const dynamic = "force-dynamic";

/* The one admin page with no requireSession() in front of it — it is how you
   get one. There is no form here any more: /admin/auth/google/start does the
   redirect, and /admin/auth/google/callback is where a session actually
   starts, once the returned email is checked against admin_users. */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  return (
    <div className="adm-login">
      <h1>Hotel Thakali Inn</h1>
      <p className="adm-sub">Staff sign in</p>

      {e === "slow" && (
        <p className="adm-error" role="alert">
          Too many attempts. Try again in a minute.
        </p>
      )}
      {e === "state" && (
        <p className="adm-error" role="alert">
          That sign-in attempt timed out or was tampered with. Try again.
        </p>
      )}
      {e === "google" && (
        <p className="adm-error" role="alert">
          Google could not confirm that sign-in. Try again.
        </p>
      )}
      {e === "notwhitelisted" && (
        <p className="adm-error" role="alert">
          That Google account is not authorized for this admin panel.
        </p>
      )}

      <a className="adm-google-btn" href="/admin/auth/google/start">
        Sign in with Google
      </a>
    </div>
  );
}

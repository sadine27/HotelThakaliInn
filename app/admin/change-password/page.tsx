import { redirect } from "next/navigation";
import { getActor, requireSession, setPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 12;

/* The one gate every seeded account has to clear before it can touch anything
   else — see requireSession()'s must_change_password check in lib/auth.ts.
   skipPasswordGate: true here so this page itself doesn't redirect to
   itself. */
export default async function ChangePassword({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  await requireSession({ skipPasswordGate: true });
  const { e } = await searchParams;

  async function changePassword(formData: FormData) {
    "use server";
    await requireSession({ skipPasswordGate: true });
    const username = await getActor();

    const next = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (next.length < MIN_LENGTH || next !== confirm) {
      redirect("/admin/change-password?e=1");
    }

    await setPassword(username, next);
    redirect("/admin");
  }

  return (
    <form className="adm-login" action={changePassword}>
      <h1>Set a new password</h1>
      <p className="adm-sub">
        This account is still using a temporary password. Choose a new one to
        continue.
      </p>

      <label htmlFor="password">New password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={MIN_LENGTH}
        autoFocus
        autoComplete="new-password"
      />

      <label htmlFor="confirm">Confirm new password</label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        required
        minLength={MIN_LENGTH}
        autoComplete="new-password"
      />

      {e === "1" && (
        <p className="adm-error" role="alert">
          Passwords must match and be at least {MIN_LENGTH} characters.
        </p>
      )}

      <button type="submit">Set password</button>
    </form>
  );
}

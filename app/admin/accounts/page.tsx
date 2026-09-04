import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import AdminNotice from "@/components/AdminNotice";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "developer", "staff"] as const;
type Role = (typeof ROLES)[number];
const isRole = (v: string): v is Role => ROLES.includes(v as Role);

type Row = { username: string; email: string | null; role: string; created_at: string };

/* Who gets in to Google login at all — this table IS the whitelist (see
   app/admin/auth/google/callback/route.ts). Editing it is gated to
   owner/developer, same per-page-guard pattern as every other admin page;
   staff can see their own account exists but not add or remove anyone. */
function requireManager(role: string) {
  if (role !== "owner" && role !== "developer") redirect("/admin");
}

export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { username: actorUsername, role } = await requireSession();
  requireManager(role);
  const { ok, err } = await searchParams;

  function notify(kind: "ok" | "err", code: string): never {
    redirect(`/admin/accounts?${kind}=${code}`);
  }

  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Account added.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Account deleted.";
  } else if (err === "taken") {
    noticeTone = "err";
    noticeMessage = "Not saved — that username or email is already in use.";
  } else if (err === "invalid") {
    noticeTone = "err";
    noticeMessage = "Not saved — a username, a valid-looking email and a role are all required.";
  } else if (err === "self") {
    noticeTone = "err";
    noticeMessage = "You can't delete the account you're signed in as.";
  } else if (err === "missing") {
    noticeTone = "err";
    noticeMessage = "That account no longer exists.";
  }

  const { results: rows } = await env.DB.prepare(
    "SELECT username, email, role, created_at FROM admin_users ORDER BY created_at ASC",
  ).all<Row>();

  async function createAccount(formData: FormData) {
    "use server";
    const { role } = await requireSession();
    requireManager(role);

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const username = get("username");
    const email = get("email").toLowerCase();
    const newRole = get("role");
    if (!username || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isRole(newRole)) {
      notify("err", "invalid");
    }

    const existing = await env.DB.prepare(
      "SELECT 1 FROM admin_users WHERE username = ?1 OR email = ?2",
    )
      .bind(username, email)
      .first();
    if (existing) notify("err", "taken");

    const write = env.DB.prepare(
      "INSERT INTO admin_users (username, email, role) VALUES (?1, ?2, ?3)",
    ).bind(username, email, newRole);
    await auditedWrite(write, {
      actor: await getActor(),
      action: "admin_user.create",
      section: "admin_users",
      slug: username,
      before: null,
      after: { username, email, role: newRole },
    });
    notify("ok", "added");
  }

  async function updateAccount(formData: FormData) {
    "use server";
    const { role } = await requireSession();
    requireManager(role);

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const username = get("username");
    const email = get("email").toLowerCase();
    const newRole = get("role");
    if (!username || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isRole(newRole)) {
      notify("err", "invalid");
    }

    const existing = await env.DB.prepare(
      "SELECT * FROM admin_users WHERE username = ?1",
    )
      .bind(username)
      .first<Row>();
    if (!existing) notify("err", "missing");

    const emailTaken = await env.DB.prepare(
      "SELECT 1 FROM admin_users WHERE email = ?1 AND username != ?2",
    )
      .bind(email, username)
      .first();
    if (emailTaken) notify("err", "taken");

    const write = env.DB.prepare(
      "UPDATE admin_users SET email = ?2, role = ?3 WHERE username = ?1",
    ).bind(username, email, newRole);
    await auditedWrite(write, {
      actor: await getActor(),
      action: "admin_user.update",
      section: "admin_users",
      slug: username,
      before: existing,
      after: { username, email, role: newRole },
    });
    notify("ok", "saved");
  }

  async function deleteAccount(formData: FormData) {
    "use server";
    const { username: actor, role } = await requireSession();
    requireManager(role);

    const username = String(formData.get("username") ?? "").trim();
    if (username === actor) notify("err", "self");

    const existing = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?1")
      .bind(username)
      .first<Row>();
    if (!existing) notify("err", "missing");

    const write = env.DB.prepare("DELETE FROM admin_users WHERE username = ?1").bind(username);
    await auditedWrite(write, {
      actor: await getActor(),
      action: "admin_user.delete",
      section: "admin_users",
      slug: username,
      before: existing,
      after: null,
    });
    notify("ok", "deleted");
  }

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Admin accounts</h1>
      <p className="adm-sub">
        Only an email listed here can sign in with Google — adding a row is
        what grants access, not the other way round.
      </p>

      <table className="adm-audit-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.username}>
              <td colSpan={5}>
                <form className="adm-account-row">
                  <input type="hidden" name="username" value={u.username} />
                  <span>{u.username}</span>
                  <input name="email" type="email" defaultValue={u.email ?? ""} required />
                  <select name="role" defaultValue={u.role}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <span>{u.created_at}</span>
                  <button type="submit" formAction={updateAccount}>
                    Save
                  </button>
                  <button
                    type="submit"
                    formAction={deleteAccount}
                    disabled={u.username === actorUsername}
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add an account</h2>
      <form className="adm-account-row" action={createAccount}>
        <input name="username" placeholder="username" required />
        <input name="email" type="email" placeholder="name@gmail.com" required />
        <select name="role" defaultValue="staff">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>

      <AdminNotice tone={noticeTone} message={noticeMessage} />
    </div>
  );
}

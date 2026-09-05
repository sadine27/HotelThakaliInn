import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import { normalizeEmail } from "@/lib/site";
import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  GRANTABLE,
  GRANT_HOURS,
  ROLES,
  can,
  grantStatement,
  isCapability,
  isRole,
  liveGrants,
  revokeStatement,
  timeLeft,
  type Capability,
  type Role,
} from "@/lib/permissions";
import AdminNotice from "@/components/AdminNotice";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

/* Who can sign in at all — this table IS the whitelist that
   app/admin/auth/google/callback/route.ts looks an email up in. Adding a row is
   what grants access; there is no second list.
 *
 * The screen this replaces was a <table> in name only: five column headings,
 * and then every row collapsed into one <td colSpan={5}> holding a flex form,
 * so nothing lined up with the label above it. It also said nothing about what
 * any of the three roles could actually do — the role was a word in a dropdown
 * and the consequences lived only in the code. Both are fixed here: one panel
 * per person, and the matrix rendered underneath from the same CAPABILITIES the
 * server enforces, so it cannot describe a rule that is not real. */

/* Module-level, not a closure inside the page component: a "use server" action
   below is hoisted to the top of the module and its captured free variables get
   serialized so the hoisted copy can rebuild them. A *function* value can't be
   serialized that way — closing over a local notify() helper (as this used to)
   throws "Functions cannot be passed directly to Client Components" the moment
   the action is rendered. */
function accountsRedirect(kind: "ok" | "err", code: string): never {
  redirect(`/admin/accounts?${kind}=${code}`);
}

type Row = { username: string; email: string | null; role: string; created_at: string };

/* Owner and developer can look. Changing anything is `accounts.manage`, which
   is the developer's outright and the owner's for 24 hours at a time. */
function requireManager(role: string) {
  if (role !== "owner" && role !== "developer") redirect("/admin");
}

const ROLE_NOTE: Record<Role, string> = {
  owner: "Runs the hotel. Everything the front desk can do, plus the audit log — and can be given the developer's four for a day at a time.",
  developer: "Everything, including the four that cannot be undone.",
  staff: "The front desk. Enquiries, bookings, and every word and photo on the site.",
};

/* Human dates, same job as the dashboard's: a raw SQLite string is not a thing
   anyone reads. SQLite writes UTC with no zone marker, so it has to be told. */
function whenLabel(stamp: string | null): string {
  if (!stamp) return "never signed in";
  const then = Date.parse(stamp.replace(" ", "T") + "Z");
  if (!Number.isFinite(then)) return stamp;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} ${days === 1 ? "day" : "days"} ago` : stamp.slice(0, 10);
}

export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await requireSession();
  requireManager(session.role);
  const manage = await can(session, "accounts.manage");
  const { ok, err } = await searchParams;

  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Account added — they can sign in with Google now.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Account deleted — that email can no longer sign in.";
  } else if (ok === "granted") {
    noticeTone = "ok";
    noticeMessage = `Access granted for ${GRANT_HOURS} hours. It ends by itself.`;
  } else if (ok === "revoked") {
    noticeTone = "ok";
    noticeMessage = "Access ended.";
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
  } else if (err === "perm") {
    noticeTone = "err";
    noticeMessage =
      "Nothing changed — this table is the login whitelist, so editing it is the developer's. Ask them to grant you access for 24 hours.";
  }

  const [{ results: rows }, { results: seen }, grants] = await Promise.all([
    env.DB.prepare(
      "SELECT username, email, role, created_at FROM admin_users ORDER BY created_at ASC",
    ).all<Row>(),
    /* Last sign-in per account, from the audit row the Google callback now
       writes. One grouped query rather than one per person. */
    env.DB.prepare(
      "SELECT actor, MAX(created_at) AS last FROM audit_log WHERE action = 'admin_login.ok' GROUP BY actor",
    )
      .all<{ actor: string; last: string }>()
      .catch(() => ({ results: [] as { actor: string; last: string }[] })),
    liveGrants(),
  ]);
  const lastSeen = new Map(seen.map((r) => [r.actor, r.last]));

  /* Every action re-asks rather than trusting the render: a grant can expire
     between this page loading and a button being pressed, and the answer that
     matters is the one true at the moment of the write. */
  async function requireManageNow() {
    const who = await requireSession();
    requireManager(who.role);
    if (!(await can(who, "accounts.manage")).allowed) accountsRedirect("err", "perm");
    return who;
  }

  async function createAccount(formData: FormData) {
    "use server";
    await requireManageNow();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const username = get("username");
    const email = normalizeEmail(get("email"));
    const newRole = get("role");
    if (!username || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isRole(newRole)) {
      accountsRedirect("err", "invalid");
    }

    const existing = await env.DB.prepare(
      "SELECT 1 FROM admin_users WHERE username = ?1 OR email = ?2",
    )
      .bind(username, email)
      .first();
    if (existing) accountsRedirect("err", "taken");

    const write = env.DB.prepare(
      "INSERT INTO admin_users (username, email, role) VALUES (?1, ?2, ?3)",
    ).bind(username, email, newRole);
    try {
      await auditedWrite(write, {
        actor: await getActor(),
        action: "admin_user.create",
        section: "admin_users",
        slug: username,
        before: null,
        after: { username, email, role: newRole },
      });
    } catch (e) {
      /* Two submits of the same row (e.g. a double-click before the button
         disables) can both pass the SELECT above and then race the INSERT —
         one wins, the other hits this raw D1 constraint error instead of the
         pre-check. Same user-facing outcome either way: already taken. */
      if (String(e).includes("UNIQUE constraint failed")) accountsRedirect("err", "taken");
      throw e;
    }
    accountsRedirect("ok", "added");
  }

  async function updateAccount(formData: FormData) {
    "use server";
    await requireManageNow();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const username = get("username");
    const email = normalizeEmail(get("email"));
    const newRole = get("role");
    if (!username || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isRole(newRole)) {
      accountsRedirect("err", "invalid");
    }

    const existing = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?1")
      .bind(username)
      .first<Row>();
    if (!existing) accountsRedirect("err", "missing");

    const emailTaken = await env.DB.prepare(
      "SELECT 1 FROM admin_users WHERE email = ?1 AND username != ?2",
    )
      .bind(email, username)
      .first();
    if (emailTaken) accountsRedirect("err", "taken");

    const write = env.DB.prepare(
      "UPDATE admin_users SET email = ?2, role = ?3 WHERE username = ?1",
    ).bind(username, email, newRole);
    try {
      await auditedWrite(write, {
        actor: await getActor(),
        action: "admin_user.update",
        section: "admin_users",
        slug: username,
        before: existing,
        after: { username, email, role: newRole },
      });
    } catch (e) {
      if (String(e).includes("UNIQUE constraint failed")) accountsRedirect("err", "taken");
      throw e;
    }
    accountsRedirect("ok", "saved");
  }

  async function deleteAccount(formData: FormData) {
    "use server";
    const who = await requireManageNow();

    const username = String(formData.get("username") ?? "").trim();
    if (username === who.username) accountsRedirect("err", "self");

    const existing = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?1")
      .bind(username)
      .first<Row>();
    if (!existing) accountsRedirect("err", "missing");

    const write = env.DB.prepare("DELETE FROM admin_users WHERE username = ?1").bind(username);
    await auditedWrite(write, {
      actor: await getActor(),
      action: "admin_user.delete",
      section: "admin_users",
      slug: username,
      before: existing,
      after: null,
    });
    accountsRedirect("ok", "deleted");
  }

  /* Granting is the developer's alone and is deliberately NOT itself grantable —
     an owner who could grant could grant themselves, which is not a lock. */
  async function grantAccess(formData: FormData) {
    "use server";
    const who = await requireSession();
    if (who.role !== "developer") accountsRedirect("err", "perm");

    const capability = String(formData.get("capability") ?? "");
    const grantee = String(formData.get("grantee") ?? "").trim();
    if (!isCapability(capability) || !GRANTABLE.includes(capability)) accountsRedirect("err", "invalid");

    /* The person has to exist and has to be a role this capability is lendable
       to — otherwise the row would sit in the table granting nothing, and read
       on this screen as access somebody has. */
    const target = await env.DB.prepare("SELECT role FROM admin_users WHERE username = ?1")
      .bind(grantee)
      .first<{ role: string }>();
    if (!target) accountsRedirect("err", "missing");
    const lendableTo = CAPABILITIES[capability].grantable as readonly Role[];
    if (!isRole(target.role) || !lendableTo.includes(target.role)) {
      accountsRedirect("err", "invalid");
    }

    await auditedWrite(grantStatement(capability, grantee, who.username), {
      actor: who.username,
      action: "permission.grant",
      section: "permission_grants",
      slug: grantee,
      before: null,
      after: { capability, grantee, hours: GRANT_HOURS },
    });
    accountsRedirect("ok", "granted");
  }

  async function revokeAccess(formData: FormData) {
    "use server";
    const who = await requireSession();
    if (who.role !== "developer") accountsRedirect("err", "perm");

    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) accountsRedirect("err", "invalid");

    const existing = await env.DB.prepare(
      "SELECT id, capability, grantee FROM permission_grants WHERE id = ?1 AND revoked_at IS NULL",
    )
      .bind(id)
      .first<{ id: number; capability: string; grantee: string }>();
    if (!existing) accountsRedirect("err", "missing");

    await auditedWrite(revokeStatement(id), {
      actor: who.username,
      action: "permission.revoke",
      section: "permission_grants",
      slug: existing.grantee,
      before: existing,
      after: null,
    });
    accountsRedirect("ok", "revoked");
  }

  const editable = manage.allowed;
  const isDeveloper = session.role === "developer";

  return (
    <div className="adm-page adm-con">
      <h1>Admin accounts</h1>
      <p className="adm-sub">
        This list <em>is</em> the door. An email here can sign in with Google; an email that is
        not here cannot, whatever else is true about it.
      </p>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

      {!editable && (
        <p className="adm-con-warn">
          You can read this page but not change it — the account table is the login whitelist, so
          editing it belongs to the developer. They can grant you {GRANT_HOURS} hours of it.
          {manage.via === "grant" ? "" : ""}
        </p>
      )}
      {manage.via === "grant" && (
        <p className="adm-con-warn">
          Editing is open to you because {manage.grantedBy} granted it —{" "}
          {manage.expiresAt ? timeLeft(manage.expiresAt) : "expiring soon"}.
        </p>
      )}

      <fieldset className="adm-con-panel">
        <legend>Who can sign in</legend>
        <div className="adm-con-rows">
          {rows.map((u) => {
            const you = u.username === session.username;
            const last = lastSeen.get(u.username) ?? null;
            return (
              <form key={u.username} className="adm-acct" action={updateAccount}>
                <input type="hidden" name="username" value={u.username} />
                <div className="adm-acct-head">
                  <span className="adm-acct-badge" aria-hidden="true">
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="adm-acct-name">{u.username}</span>
                  {you && <span className="adm-con-lock">you</span>}
                  <span className="adm-acct-seen" data-never={last ? undefined : "1"}>
                    {whenLabel(last)}
                  </span>
                </div>

                <label className="adm-acct-field">
                  <span>Google address</span>
                  <input
                    name="email"
                    type="email"
                    className="adm-con-mono"
                    defaultValue={u.email ?? ""}
                    disabled={!editable}
                    required
                  />
                </label>

                {/* Radios drawn as buttons, not a <select>: all three choices
                    are visible, and what each one means is written underneath
                    rather than hidden in a list you have to open. Native inputs,
                    so this whole screen stays a server component. */}
                <div className="adm-acct-roles" role="group" aria-label={`Role for ${u.username}`}>
                  {ROLES.map((r) => (
                    <label key={r} className="adm-acct-role">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        defaultChecked={u.role === r}
                        disabled={!editable}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
                <p className="adm-con-hint">{isRole(u.role) ? ROLE_NOTE[u.role] : "Unknown role."}</p>

                {editable && (
                  <div className="adm-acct-actions">
                    <SubmitButton
                      type="submit"
                      className="adm-btn adm-btn--go"
                      pendingText="Saving…"
                    >
                      Save
                    </SubmitButton>
                    <span className="adm-con-hint">
                      Added {u.created_at.slice(0, 10)}
                    </span>
                  </div>
                )}

                {/* Removal sits in its own strip, below everything else, because
                    the one control on this panel that cannot be undone should
                    not sit next to the one you press every day. */}
                {editable && !you && (
                  <div className="adm-acct-danger">
                    <SubmitButton
                      type="submit"
                      formAction={deleteAccount}
                      className="adm-btn adm-btn--x adm-acct-remove"
                      pendingText="Removing…"
                    >
                      Remove {u.username}
                    </SubmitButton>
                    <span>They lose access immediately. A deletion alert is sent.</span>
                  </div>
                )}
              </form>
            );
          })}
        </div>
      </fieldset>

      {editable && (
        <fieldset className="adm-con-panel">
          <legend>Add someone</legend>
          <form className="adm-acct" action={createAccount}>
            <div className="adm-con-grid">
              <div className="adm-con-field">
                <label htmlFor="new-username">Username</label>
                <input id="new-username" name="username" placeholder="reception" required />
                <p className="adm-con-hint">What the audit log will call them. No spaces, no @.</p>
              </div>
              <div className="adm-con-field">
                <label htmlFor="new-email">Google address</label>
                <input
                  id="new-email"
                  name="email"
                  type="email"
                  className="adm-con-mono"
                  placeholder="name@gmail.com"
                  required
                />
                <p className="adm-con-hint">
                  The exact account they press &ldquo;Sign in with Google&rdquo; with.
                </p>
              </div>
            </div>
            <div className="adm-acct-roles" role="group" aria-label="Role for the new account">
              {ROLES.map((r) => (
                <label key={r} className="adm-acct-role">
                  <input type="radio" name="role" value={r} defaultChecked={r === "staff"} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <div className="adm-acct-actions">
              <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Adding…">
                Add
              </SubmitButton>
            </div>
          </form>
        </fieldset>
      )}

      {/* Rendered from the same CAPABILITIES the server checks against, so this
          table cannot drift into describing a rule that isn't enforced. */}
      <fieldset className="adm-con-panel">
        <legend>What each role can do</legend>
        <div className="adm-matrix-wrap">
          <table className="adm-matrix">
            <thead>
              <tr>
                <th scope="col">Can</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  Enquiries, bookings, pages, rooms, photos, contact &amp; facts
                  <span>The everyday work. Nothing here is gated.</span>
                </th>
                {ROLES.map((r) => (
                  <td key={r} data-state="yes">
                    yes
                  </td>
                ))}
              </tr>
              {CAPABILITY_KEYS.map((cap: Capability) => (
                <tr key={cap}>
                  <th scope="row">
                    {CAPABILITIES[cap].label}
                    <span>{CAPABILITIES[cap].note}</span>
                  </th>
                  {ROLES.map((r) => {
                    const holds = (CAPABILITIES[cap].holders as readonly Role[]).includes(r);
                    const lend = (CAPABILITIES[cap].grantable as readonly Role[]).includes(r);
                    return (
                      <td key={r} data-state={holds ? "yes" : lend ? "grant" : "no"}>
                        {holds ? "yes" : lend ? `${GRANT_HOURS} h` : "no"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-con-hint">
          &ldquo;{GRANT_HOURS} h&rdquo; means it is not theirs, but the developer can lend it —
          it ends by itself after {GRANT_HOURS} hours, with no one having to remember to take it
          back.
        </p>
      </fieldset>

      {isDeveloper && (
        <fieldset className="adm-con-panel">
          <legend>Access grants</legend>
          <p className="adm-con-hint">
            An owner phones or messages you; you approve it here. Nothing on this panel is
            available to anyone but you — an owner who could grant could grant themselves, which
            would not be a lock at all.
          </p>

          <div className="adm-con-rows">
            {grants.length === 0 && <p className="adm-con-empty">No one currently holds a grant.</p>}
            {grants.map((g) => (
              <form key={g.id} className="adm-con-row" action={revokeAccess}>
                <input type="hidden" name="id" value={g.id} />
                <span className="adm-con-rowlabel">{g.grantee}</span>
                <span className="adm-con-flex">
                  {isCapability(g.capability) ? CAPABILITIES[g.capability].label : g.capability}
                </span>
                <span className="adm-con-readout">{timeLeft(g.expires_at)}</span>
                <SubmitButton type="submit" className="adm-btn adm-btn--sm" pendingText="Ending…">
                  End it now
                </SubmitButton>
              </form>
            ))}
          </div>

          <form className="adm-acct" action={grantAccess}>
            <div className="adm-con-grid">
              <div className="adm-con-field">
                <label htmlFor="grantee">Give it to</label>
                <select id="grantee" name="grantee" required>
                  {rows
                    .filter((u) => u.role === "owner")
                    .map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                </select>
              </div>
              <div className="adm-con-field">
                <label htmlFor="capability">What for</label>
                <select id="capability" name="capability" required>
                  {GRANTABLE.map((c) => (
                    <option key={c} value={c}>
                      {CAPABILITIES[c].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="adm-acct-actions">
              <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Granting…">
                Grant for {GRANT_HOURS} hours
              </SubmitButton>
              {rows.every((u) => u.role !== "owner") && (
                <span className="adm-con-hint">There are no owner accounts to grant to yet.</span>
              )}
            </div>
          </form>
        </fieldset>
      )}
    </div>
  );
}

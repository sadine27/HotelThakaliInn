import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import { settings } from "@/lib/content";
import AdminNotice from "@/components/AdminNotice";
import {
  canEditEmail,
  composeAll,
  computeErrors,
  sanitizeFormValues,
  toFormValues,
} from "@/lib/settings-schema";
import SettingsForm, { type SaveState } from "./SettingsForm";

export const dynamic = "force-dynamic";

/* The screen itself is ./SettingsForm.tsx — a client component, because live
   validation lamps and a preview that updates as you type are the whole point
   of the rebuild. What is left here is the two things that must be on the
   server: reading the current values, and the action that writes them.
 *
 * The action deliberately does NOT trust anything the form decided. It rebuilds
 * FormValues from the POST, runs the very same computeErrors() the console runs,
 * and refuses on any failure. The client-side checks are a convenience for the
 * person typing; this is the boundary. */

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { role } = await requireSession();
  const config = await settings();
  const { ok, err } = await searchParams;

  /* The save action redirects back here with a code; this turns the code into
     the popup's copy. No code, no popup. A failed save no longer comes back
     through the URL — it returns its errors to the form instead, so nothing
     anyone typed is lost on the way. */
  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved — the site now shows the new details.";
  } else if (err === "email") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — only an owner or developer can change the email address.";
  }

  async function save(_prev: SaveState, formData: FormData): Promise<SaveState> {
    "use server";
    const { role } = await requireSession();

    let parsed: unknown;
    try {
      parsed = JSON.parse(String(formData.get("values") ?? "null"));
    } catch {
      return { errors: { form: "That save did not arrive in one piece — try again." } };
    }
    /* Coerced to the right shape before anything walks it, then checked by the
       same function the console uses. Two readings of "valid" is how a panel
       ends up saying VALID to something the server refuses. */
    const values = sanitizeFormValues(parsed);
    const errors = computeErrors(values);
    if (Object.keys(errors).length) return { errors };

    const rows = Object.entries(composeAll(values));

    /* Resolved before the write, same reason as every other auditedWrite call
       site: a D1 batch can't feed one statement's output into another's
       bindings, so "before" has to come from its own SELECT first. */
    const keys = rows.map(([k]) => k);
    const placeholders = keys.map((_, i) => `?${i + 1}`).join(", ");
    const { results: existing } = await env.DB.prepare(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    )
      .bind(...keys)
      .all<{ key: string; value: string }>();
    const before = Object.fromEntries(existing.map((r) => [r.key, r.value]));

    /* The email lock, enforced where it counts. wrangler.jsonc pins
       allowed_destination_addresses to one address so a bug in the public
       contact endpoint can never turn the domain into an open relay — which
       means changing this row without a matching deploy silently stops every
       enquiry notification. The console disables the field for staff; this is
       what makes that more than a disabled attribute. Refusing the whole save
       rather than quietly dropping the key, because a save that reports success
       while ignoring half of what was sent is worse than one that fails. */
    const after = Object.fromEntries(rows);
    if (!canEditEmail(role) && before.email !== undefined && before.email !== after.email) {
      redirect("/admin/settings?err=email");
    }

    /* UPDATE, never INSERT: these keys are a fixed vocabulary that pages read
       by name, so a new row would be a value nothing renders. A key the
       database does not have yet (before migration 0017 is applied) is simply
       an UPDATE that matches nothing, rather than a failure. */
    const stmt = env.DB.prepare("UPDATE settings SET value = ?2 WHERE key = ?1");
    await auditedWrite(
      rows.map(([k, v]) => stmt.bind(k, v)),
      {
        actor: await getActor(),
        action: "settings.update",
        before,
        after,
      },
    );
    redirect("/admin/settings?ok=saved");
  }

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Contact details &amp; property facts</h1>
      <p className="adm-sub">Saved straight to the live site</p>
      <AdminNotice tone={noticeTone} message={noticeMessage} />
      <SettingsForm initial={toFormValues(config)} role={role} save={save} />
    </div>
  );
}

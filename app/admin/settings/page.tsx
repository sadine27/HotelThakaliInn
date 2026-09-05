import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import { section, settings } from "@/lib/content";
import AdminNotice from "@/components/AdminNotice";
import { can, timeLeft } from "@/lib/permissions";
import {
  composeAll,
  computeErrors,
  sanitizeFormValues,
  toFormValues,
  tidy,
} from "@/lib/settings-schema";
import SettingsForm, { type SaveState } from "./SettingsForm";

export const dynamic = "force-dynamic";

/* Only the part of a room row this screen owns. The full shape lives in
   app/rooms/page.tsx and app/admin/content/page.tsx; naming the one field here
   keeps the merge below honest about what it is allowed to touch. */
type RoomExtra = { sizeValue?: string };

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
  const session = await requireSession();
  const emailAccess = await can(session, "settings.email");
  /* Room sizes are `content` rows, not settings — the three rooms have always
     been separate records and only their size was ever a single hotel-wide
     sentence. includeHidden, because an unpublished room still has a size and
     hiding it from this panel would make the number unreachable. */
  const [config, roomRows] = await Promise.all([settings(), section<RoomExtra>("room", true)]);
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
    noticeMessage =
      "Nothing was saved — the email row is the developer's, and any access granted for it has run out. Ask them; a grant lasts 24 hours.";
  }

  async function save(_prev: SaveState, formData: FormData): Promise<SaveState> {
    "use server";
    const actor = await requireSession();

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
    if (before.email !== undefined && before.email !== after.email) {
      /* Asked at the moment of the write, not at page load: a grant can expire
         between opening this screen and pressing Save, and the answer that
         matters is the one that is true when the row changes. */
      const { allowed } = await can(actor, "settings.email");
      if (!allowed) redirect("/admin/settings?err=email");
    }

    /* The room sizes are the one thing on this screen that is not a settings
       row. Each is merged into its room's existing `extra` JSON rather than
       replacing it, because that column also carries the beds, the capacity and
       the specs list that /admin/content owns — writing the whole object from
       here would silently drop all of it.

       The slugs come off the network with everything else, so they are matched
       against the rows actually in the table rather than trusted: a slug this
       screen never offered simply has nothing to update. */
    const live = await section<RoomExtra>("room", true);
    const bySlug = new Map(live.map((r) => [r.slug, r]));
    const roomWrites = values.rooms
      .filter((r) => bySlug.has(r.slug))
      .map((r) => {
        const room = bySlug.get(r.slug)!;
        const extra = JSON.stringify({ ...room.extra, sizeValue: tidy(r.value) });
        return env.DB.prepare(
          "UPDATE content SET extra = ?2 WHERE section = 'room' AND slug = ?1",
        ).bind(r.slug, extra);
      });

    /* UPDATE, never INSERT: these keys are a fixed vocabulary that pages read
       by name, so a new row would be a value nothing renders. A key the
       database does not have yet (before migration 0017 is applied) is simply
       an UPDATE that matches nothing, rather than a failure. */
    const stmt = env.DB.prepare("UPDATE settings SET value = ?2 WHERE key = ?1");
    await auditedWrite(
      [...rows.map(([k, v]) => stmt.bind(k, v)), ...roomWrites],
      {
        actor: await getActor(),
        action: "settings.update",
        before: { ...before, rooms: live.map((r) => [r.slug, r.extra.sizeValue ?? ""]) },
        after: { ...after, rooms: values.rooms.map((r) => [r.slug, tidy(r.value)]) },
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
      <SettingsForm
        initial={toFormValues(
          config,
          roomRows.map((r) => ({ slug: r.slug, title: r.title, sizeValue: r.extra.sizeValue ?? "" })),
        )}
        emailAccess={{
          allowed: emailAccess.allowed,
          via: emailAccess.via,
          leftLabel: emailAccess.expiresAt ? timeLeft(emailAccess.expiresAt) : null,
          grantedBy: emailAccess.grantedBy,
        }}
        save={save}
      />
    </div>
  );
}

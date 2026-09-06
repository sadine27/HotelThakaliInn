/* The photo bank.
 *
 * Until now a photo existed only as a path typed into a box on /admin/content,
 * and the only way to see one was a 32px thumbnail. There was no way to ask
 * "what photos do we have", no way to reuse one on a second card without
 * copying its path by hand, and no way to know how much room was left. This is
 * that screen: a contact sheet on the left, one photo large on the right, and
 * a gauge that makes the storage question answerable at a glance rather than
 * from memory.
 *
 * The uploads themselves go through app/admin/photos/upload/route.ts, not a Server
 * Action — see the comment there about the 3 MB body ceiling.
 */
import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import AdminNotice from "@/components/AdminNotice";
import BankBoard from "@/components/BankBoard";
import { auditedWrite } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { mediaReferences } from "@/lib/content";
import { CAPS } from "@/lib/media";
import { bankItems, bankStats, dailyCount } from "@/lib/media-store";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/* Hoisted for the same reason app/admin/content/page.tsx hoists its own: a
   "use server" closure can capture serializable data, not a function value, so
   a redirect helper declared inside the component fails to serialize. */
function photosRedirect(code: string, kind: "ok" | "err" = "ok"): never {
  redirect(`/admin/photos?${kind}=${code}`);
}

export default async function Photos({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await requireSession();
  const { ok, err } = await searchParams;

  /* Resolved once for the render; every action re-checks at write time, because
     a 24-hour grant can expire between drawing the button and pressing it. */
  const canDelete = (await can(session, "content.delete")).allowed;

  const [items, stats, usedToday] = await Promise.all([
    bankItems(),
    bankStats(),
    dailyCount("photo"),
  ]);

  async function saveDetails(formData: FormData) {
    "use server";
    const actor = await requireSession();
    const key = formData.get("key")?.toString() ?? "";
    if (!key) photosRedirect("save", "err");

    /* The name is what the bank is searched by, so an empty one is not a tidy
       row — it is a photo nobody will ever find again. */
    const name = (formData.get("name")?.toString() ?? "").trim().slice(0, 120);
    if (!name) photosRedirect("noname", "err");
    const origin = (formData.get("originUrl")?.toString() ?? "").trim().slice(0, 500);
    /* A link that is not a link is worse than an empty box: it looks like an
       answer to "where is the original" and is not one. */
    if (origin && !/^https?:\/\//i.test(origin)) photosRedirect("link", "err");

    const before = await env.DB.prepare(
      "SELECT name, origin_url FROM media_assets WHERE key = ?1",
    )
      .bind(key)
      .first<{ name: string; origin_url: string }>();
    if (!before) photosRedirect("gone", "err");

    const write = env.DB.prepare(
      "UPDATE media_assets SET name = ?2, origin_url = ?3 WHERE key = ?1",
    ).bind(key, name, origin);

    await auditedWrite(write, {
      actor: actor.username,
      action: "media.update",
      section: "media",
      slug: key,
      before,
      after: { name, origin_url: origin },
    });
    photosRedirect("saved");
  }

  async function removeItem(formData: FormData) {
    "use server";
    const actor = await requireSession();
    /* Not just a hidden button: a disabled control stops nobody who can write a
       POST, and this is the action that destroys a file. */
    if (!(await can(actor, "content.delete")).allowed) photosRedirect("perm", "err");

    const key = formData.get("key")?.toString() ?? "";
    if (!key) photosRedirect("save", "err");

    const row = await env.DB.prepare(
      "SELECT key, name, thumb_key, poster_key, bytes FROM media_assets WHERE key = ?1",
    )
      .bind(key)
      .first<{ key: string; name: string; thumb_key: string; poster_key: string; bytes: number }>();
    if (!row) photosRedirect("gone", "err");

    /* Re-read at write time rather than trusting what the screen was showing.
       Between the page rendering and this click, another tab may have attached
       this photo to a card, and deleting it would leave a hole on the site. */
    const refs = await mediaReferences();
    if ((refs.get(`/img/${key}`) ?? []).length) photosRedirect("inuse", "err");

    await auditedWrite(
      env.DB.prepare("DELETE FROM media_assets WHERE key = ?1").bind(key),
      {
        actor: actor.username,
        action: "media.delete",
        section: "media",
        slug: key,
        before: { name: row.name, bytes: row.bytes },
      },
    );

    /* After the row, never before: an object with no row is invisible to the
       gauge and to this screen, while a row with no object is one broken
       thumbnail that says exactly which file went missing. */
    await Promise.all(
      [row.key, row.thumb_key, row.poster_key]
        .filter(Boolean)
        .map((k) => env.MEDIA.delete(k).catch(() => {})),
    );
    photosRedirect("deleted");
  }

  return (
    <div className="adm-page adm-con">
      <h1>Photo bank</h1>
      <p className="adm-sub">
        Every photo and clip the site can use, in one place — no file names to type
      </p>
      <AdminNotice
        tone={err ? "err" : ok ? "ok" : undefined}
        message={err ? (ERR_MESSAGE[err] ?? "That did not work.") : ok ? (OK_MESSAGE[ok] ?? "Done.") : undefined}
      />

      <BankBoard
        items={items}
        canDelete={canDelete}
        leftToday={Math.max(0, CAPS.photo - usedToday)}
        bytes={stats.bytes}
        saveDetails={saveDetails}
        removeItem={removeItem}
      />
    </div>
  );
}

const OK_MESSAGE: Record<string, string> = {
  saved: "Saved.",
  deleted: "The photo was deleted.",
};

const ERR_MESSAGE: Record<string, string> = {
  perm: "Deleting photos needs a developer, or an owner holding a 24-hour unlock.",
  inuse: "That photo is still used on the site, so it was not deleted.",
  gone: "That photo is no longer in the bank — someone else may have removed it.",
  link: "The link to the original needs to start with https:// to be openable.",
  save: "Nothing was saved — the photo could not be identified.",
  noname: "Give it a name before saving — that is what everyone searches by.",
};

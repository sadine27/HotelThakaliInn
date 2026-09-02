import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import PhotoField from "@/components/PhotoField";
import { mediaReferences, section } from "@/lib/content";

export const dynamic = "force-dynamic";

/* The vocabulary of the `content` table. It is a whitelist, not a label list:
   every write below checks against it, so a hand-crafted POST cannot invent a
   section and park rows in the table that nothing renders and nobody sees. */
const SECTIONS = [
  "hero",
  "service",
  "room",
  "gallery",
  "breakfast",
  "amenity",
  "menu_breakfast",
  "menu_snacks",
  "menu_mains",
  "menu_bar",
] as const;
type Section = (typeof SECTIONS)[number];

const isSection = (value: string): value is Section => SECTIONS.includes(value as Section);

/* The client sends a MIME type it chose, and a .txt renamed to .jpg keeps its
   text/plain nowhere at all — so the file's own first bytes decide. This is the
   free equivalent of env.IMAGES.info(): if a paid Images subscription is ever
   confirmed, swap in info() and delete this table. */
const MAGIC: [string, string, number[]][] = [
  ["image/jpeg", "jpg", [0xff, 0xd8, 0xff]],
  ["image/png", "png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/webp", "webp", [0x52, 0x49, 0x46, 0x46]], // RIFF; bytes 8-11 spell WEBP
];

/* Comfortably above a 1600px JPEG (the seeded ones are 200-400 KB) and below
   the 3 MB Server Action body cap in next.config.mjs, so this check is the one
   that rejects rather than the transport. */
const MAX = 2 * 1024 * 1024;

/* Deletes a replaced or removed upload, but only when no other row points at
   it: the image field is free text, and staff can paste another row's /img/
   key into it. Seeded /media/ paths are never touched. Without this, every
   photo replacement leaks ~200-400 KB into the free-tier bucket forever. */
async function dropOrphan(image: string | undefined) {
  if (!image?.startsWith("/img/")) return;
  const { results } = await env.DB.prepare(
    "SELECT 1 FROM content WHERE image = ?1 OR video = ?1 LIMIT 1",
  )
    .bind(image)
    .all();
  if (results.length) return;
  await env.MEDIA.delete(image.slice(5));
}

/* Every uploaded photo that no row points at any more.
 *
 * `dropOrphan` keeps the bucket clean going forward, but it did not always
 * exist, and it cannot see a row deleted straight out of D1 by hand. This is the
 * sweep: R2 holds the truth about what was uploaded, `content.image` holds the
 * truth about what is used, and anything in the first set and not the second is
 * paying rent for nothing. Only /img/ keys are considered — the seeded /media/
 * paths are files in the repo, not uploads, and are not ours to delete. */
async function findUnused() {
  const [objects, refs] = await Promise.all([
    env.MEDIA.list({ limit: 1000 }),
    mediaReferences(),
  ]);
  /* Only /img/ keys are uploads — the seeded /media/ paths are repo files, and a
     video column can hold an external URL that never starts with /img/. */
  const referenced = new Set(
    [...refs.keys()].filter((k) => k.startsWith("/img/")).map((k) => k.slice(5)),
  );
  return objects.objects
    .filter((o) => !referenced.has(o.key))
    .map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded }));
}

/* Column names are generic because one table serves six sections. On this screen
   they need to read as the thing being edited. */
const TITLES: Record<Section, string> = {
  hero: "Home — the big slides",
  service: "Home — the small cards",
  room: "Rooms",
  gallery: "Gallery photos",
  breakfast: "Breakfast",
  amenity: "Amenities",
  menu_breakfast: "Menu — Breakfast",
  menu_snacks: "Menu — Snacks & Starters",
  menu_mains: "Menu — Mains",
  menu_bar: "Menu — Bar & Drinks",
};

export default async function Content({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  await requireSession();
  const { s } = await searchParams;
  const name: Section = s && isSection(s) ? s : "hero";

  /* true = include unpublished. Without it the "Show on the site" checkbox is a
     one-way door: unticking a row drops it out of this list too. */
  const rows = await section(name, true);
  /* Not per-section: an unused photo belongs to no section by definition. */
  const unused = await findUnused().catch(() => []);

  async function saveItem(formData: FormData) {
    "use server";
    await requireSession();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const sec = get("section");
    const slug = get("slug");
    if (!isSection(sec) || !slug) return;

    /* A malformed `extra` makes every page in this section throw on JSON.parse.
       Reject the write; keep the row. */
    const extra = get("extra") || "{}";
    try {
      JSON.parse(extra);
    } catch {
      return;
    }

    /* Insert-or-update in one statement: there is no separate "new row" screen,
       so this action serves both the blank form at the end of the list and every
       existing row above it. */
    await env.DB.prepare(
      `INSERT INTO content (section, slug, position, title, tag, body, href, image, video, extra, published, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
       ON CONFLICT (section, slug) DO UPDATE SET
         position = ?3, title = ?4, tag = ?5, body = ?6, href = ?7,
         image = ?8, video = ?9, extra = ?10, published = ?11,
         updated_at = datetime('now')`,
    )
      .bind(
        sec,
        slug,
        Number(get("position")) || 0,
        get("title"),
        get("tag"),
        get("body"),
        get("href"),
        get("image"),
        get("video"),
        extra,
        formData.get("published") ? 1 : 0,
      )
      .run();
  }

  async function upload(formData: FormData) {
    "use server";
    await requireSession();

    const file = formData.get("file");
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!(file instanceof File) || !file.size || file.size > MAX || !isSection(sec) || !slug) return;

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const match = MAGIC.find(([, , sig]) => sig.every((b, i) => head[i] === b));
    if (!match) return;
    const [type, ext] = match;
    /* RIFF is also AVI and WAV. Only the WEBP fourcc makes it an image. */
    if (type === "image/webp" && String.fromCharCode(...head.slice(8, 12)) !== "WEBP") return;

    /* The row is fetched before anything is written. The upload form only exists
       on saved rows, so a miss means the row was deleted from another tab — and
       an unwritten blob is the only blob that costs nothing. */
    const row = await env.DB.prepare(
      "SELECT image FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first<{ image: string }>();
    if (!row) return;

    /* The uploaded filename is never used — not as the key, not as metadata. It
       is attacker-controlled text and a UUID answers every question it would,
       including "is this a new photo or the old one cached forever". */
    const key = `${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });

    const { meta } = await env.DB.prepare(
      "UPDATE content SET image = ?3, updated_at = datetime('now') WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug, `/img/${key}`)
      .run();
    /* The row vanished between the SELECT and the UPDATE: take the new blob
       back out, or it sits in the bucket forever with no row pointing at it. */
    if (!meta.changes) {
      await env.MEDIA.delete(key);
      return;
    }
    await dropOrphan(row.image);
  }

  async function deleteUnused(formData: FormData) {
    "use server";
    await requireSession();
    const key = String(formData.get("key") ?? "");
    /* The list is recomputed rather than trusted: the button was rendered from
       a snapshot, and in the seconds since, someone in another tab may have
       pointed a row at exactly this file. Deleting it then would blank a photo
       on the live site. */
    const stillUnused = await findUnused();
    if (!stillUnused.some((o) => o.key === key)) return;
    await env.MEDIA.delete(key);
  }

  async function removeItem(formData: FormData) {
    "use server";
    await requireSession();
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!isSection(sec) || !slug) return;
    const row = await env.DB.prepare(
      "DELETE FROM content WHERE section = ?1 AND slug = ?2 RETURNING image",
    )
      .bind(sec, slug)
      .first<{ image: string }>();
    await dropOrphan(row?.image);
  }

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Pages, rooms &amp; photos</h1>
      <p className="adm-sub">{TITLES[name]}</p>

      <nav className="adm-tabs">
        {SECTIONS.map((x) => (
          <Link
            key={x}
            href={`/admin/content?s=${x}`}
            aria-current={x === name ? "page" : undefined}
          >
            {x}
          </Link>
        ))}
      </nav>

      {[...rows, null].map((row, i) => (
        /* The upload is a sibling form, not a nested one — a <form> inside a
           <form> is invalid HTML and browsers silently drop the inner one. */
        <div key={row?.slug ?? "new"} className="adm-row">
        <form className="adm-item" action={saveItem}>
          <input type="hidden" name="section" value={name} />

          <div className="adm-field">
            <label>slug</label>
            {/* Read-only on an existing row: (section, slug) is the primary key,
                so editing it here would silently create a duplicate rather than
                rename. Renaming is delete-then-add, which is also what makes an
                orphaned image obvious. */}
            <input name="slug" defaultValue={row?.slug ?? ""} required readOnly={!!row} />
            {!row && <small>A short name, lowercase, no spaces. It cannot be changed later.</small>}
          </div>

          <div className="adm-field">
            <label>order</label>
            <input name="position" type="number" defaultValue={i} />
            <small>Lowest first.</small>
          </div>

          <div className="adm-field">
            <label>title</label>
            <input name="title" defaultValue={row?.title ?? ""} />
          </div>

          <div className="adm-field">
            <label>tag</label>
            <input name="tag" defaultValue={row?.tag ?? ""} />
            <small>The small line above or beside the title.</small>
          </div>

          <div className="adm-field">
            <label>body</label>
            <textarea name="body" rows={3} defaultValue={row?.body ?? ""} />
          </div>

          <div className="adm-field">
            <label>href</label>
            <input name="href" defaultValue={row?.href ?? ""} />
          </div>

          <div className="adm-field">
            <label>image</label>
            <input name="image" defaultValue={row?.image ?? ""} />
            <small>A path like /media/rooms/deluxe-king.jpg</small>
          </div>

          <div className="adm-field">
            <label>video</label>
            <input name="video" defaultValue={row?.video ?? ""} />
          </div>

          <div className="adm-field">
            <label>extra (JSON)</label>
            <textarea name="extra" rows={2} defaultValue={JSON.stringify(row?.extra ?? {})} />
            <small>Keep the braces and quotes. If they are wrong, nothing is saved.</small>
          </div>

          <label className="adm-check">
            <input name="published" type="checkbox" defaultChecked={row ? row.published === 1 : true} />
            <span>Show on the site</span>
          </label>

          <button type="submit">{row ? "Save" : "Add"}</button>
        </form>

        {/* Only on an existing row: the action writes to a row identified by
            (section, slug), so there is nothing to attach a photo to until the
            row has been added. */}
        {row && (
          <form action={upload} encType="multipart/form-data" className="adm-upload">
            <input type="hidden" name="section" value={name} />
            <input type="hidden" name="slug" value={row.slug} />
            <label>photo</label>
            <PhotoField />
            <button type="submit">Upload photo</button>
            <small>
              JPEG, PNG or WebP. Big photos are resized in your browser before they are sent, so
              a photo straight off a phone or camera is fine. It replaces the image path above.
            </small>
          </form>
        )}
        </div>
      ))}

      {unused.length > 0 && (
        <div className="adm-unused">
          <h2>Photos nothing is using</h2>
          <p>
            {unused.length} uploaded {unused.length === 1 ? "photo is" : "photos are"} not shown
            anywhere on the site — replaced by a newer one, or left behind by a row that was
            deleted. They cost storage and nothing else. Deleting one cannot change any page,
            because no page points at it.
          </p>
          <ul>
            {unused.map((o) => (
              <li key={o.key}>
                {/* The photo itself, not just its name: staff recognise a room,
                    not a UUID, and "is this the one I meant to keep" is the only
                    question this panel has to answer. */}
                <a href={`/img/${o.key}`} target="_blank" rel="noopener noreferrer">
                  <img src={`/img/${o.key}`} alt="" loading="lazy" />
                </a>
                <span className="adm-unused-meta">
                  {Math.round(o.size / 1024)} KB
                  <br />
                  {o.uploaded.toISOString().slice(0, 10)}
                </span>
                <form action={deleteUnused}>
                  <input type="hidden" name="key" value={o.key} />
                  <button type="submit">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="adm-danger">
          <h2>Delete</h2>
          <p>There is no undo. A deleted row is gone from the site immediately.</p>
          {rows.map((row) => (
            <form key={`rm-${row.slug}`} action={removeItem} className="adm-remove">
              <input type="hidden" name="section" value={name} />
              <input type="hidden" name="slug" value={row.slug} />
              <button type="submit">Delete {row.slug}</button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

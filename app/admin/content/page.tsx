import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { section } from "@/lib/content";

export const dynamic = "force-dynamic";

/* The vocabulary of the `content` table. It is a whitelist, not a label list:
   every write below checks against it, so a hand-crafted POST cannot invent a
   section and park rows in the table that nothing renders and nobody sees. */
const SECTIONS = ["hero", "service", "room", "gallery", "breakfast", "amenity"] as const;
type Section = (typeof SECTIONS)[number];

const isSection = (value: string): value is Section => SECTIONS.includes(value as Section);

/* Column names are generic because one table serves six sections. On this screen
   they need to read as the thing being edited. */
const TITLES: Record<Section, string> = {
  hero: "Home — the big slides",
  service: "Home — the small cards",
  room: "Rooms",
  gallery: "Gallery photos",
  breakfast: "Breakfast",
  amenity: "Amenities",
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

  async function removeItem(formData: FormData) {
    "use server";
    await requireSession();
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!isSection(sec) || !slug) return;
    await env.DB.prepare("DELETE FROM content WHERE section = ?1 AND slug = ?2")
      .bind(sec, slug)
      .run();
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
        <form key={row?.slug ?? "new"} className="adm-item" action={saveItem}>
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
      ))}

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

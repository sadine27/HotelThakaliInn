import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import PhotoField from "@/components/PhotoField";
import AdminNotice from "@/components/AdminNotice";
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
  /* No "breakfast": /breakfast is now a redirect to /cuisine and nothing calls
     section("breakfast") any more, so its tab let staff edit rows at length for
     no effect on the site. The three dead rows are left in D1 — they point only
     at repo photos under /media/, so they pin nothing in R2 and cost nothing. */
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
    "SELECT 1 FROM content WHERE image = ?1 OR video = ?1 OR icon = ?1 LIMIT 1",
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
  /* R2's list() caps at 1000 keys a call and says so via `truncated`/`cursor` —
     a single call silently stopped seeing (and thus never flagged) anything
     uploaded past the first 1000. Looping the cursor is what keeps a bucket
     that outgrows one page from quietly hiding its own orphans. */
  const refsPromise = mediaReferences();
  const objects: { key: string; size: number; uploaded: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({ limit: 1000, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const refs = await refsPromise;
  /* Only /img/ keys are uploads — the seeded /media/ paths are repo files, and a
     video column can hold an external URL that never starts with /img/. */
  const referenced = new Set(
    [...refs.keys()].filter((k) => k.startsWith("/img/")).map((k) => k.slice(5)),
  );
  return objects
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
  amenity: "Amenities",
  menu_breakfast: "Menu — Breakfast",
  menu_snacks: "Menu — Snacks & Starters",
  menu_mains: "Menu — Mains",
  menu_bar: "Menu — Bar & Drinks",
};

/* Which of the generic columns a section's own page actually reads — checked
   against every page in app/ that calls section(). A field no page reads is a
   blank box on this screen for every single row, so it is left off the form
   entirely rather than shown empty: href only feeds the home page's small
   cards, video only the gallery, icon and paid only amenities, and extra only
   rooms (count/meta/specs) and the four menus (price). */
const FIELDS: Record<
  Section,
  { image?: true; href?: true; video?: true; icon?: true; paid?: true; extra?: true }
> = {
  hero: { image: true },
  service: { image: true, href: true },
  room: { image: true, extra: true },
  gallery: { image: true, video: true },
  amenity: { icon: true, paid: true },
  menu_breakfast: { extra: true },
  menu_snacks: { extra: true },
  menu_mains: { extra: true },
  menu_bar: { extra: true },
};

const SORTS = ["position", "title", "updated"] as const;
type Sort = (typeof SORTS)[number];
const isSort = (value: string): value is Sort => (SORTS as readonly string[]).includes(value);
const SORT_LABEL: Record<Sort, string> = { position: "Order", title: "Title", updated: "Recently updated" };

/* menu_bar alone seeds past 120 rows — a <details> per row is a full <form>
   with a dozen fields, and rendering all of them unconditionally is what
   makes that tab heavy to load and scroll. Paged the same way search and sort
   already are: through the URL, no client state. */
const PAGE_SIZE = 40;

export default async function Content({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; q?: string; sort?: string; page?: string; ok?: string; err?: string }>;
}) {
  await requireSession();
  const { s, q, sort: sortParam, page: pageParam, ok, err } = await searchParams;
  const name: Section = s && isSection(s) ? s : "hero";
  const query = (q ?? "").trim();
  const sort: Sort = sortParam && isSort(sortParam) ? sortParam : "position";
  const fields = FIELDS[name];

  /* true = include unpublished. Without it the "Show on the site" checkbox is a
     one-way door: unticking a row drops it out of this list too. */
  const allRows = await section(name, true);
  /* Not per-section: an unused photo belongs to no section by definition. */
  const unused = await findUnused().catch(() => []);

  /* Ten past the last row, not `rows.length`. Positions are sparse on purpose —
     the amenity seed leaves gaps between categories, running to 181 across 68
     rows — so a count would drop every new amenity into the middle of the list
     instead of the end. The gap of ten also leaves room to slot a row between
     two others by hand without renumbering anything. */
  const nextPosition = (allRows.at(-1)?.position ?? -10) + 10;

  /* Search matches what a row is found by, not the whole record — the body text
     of an amenity is often longer than its title and would swamp a match on
     "wifi" with unrelated hits on "network cable" three rows down. */
  const needle = query.toLowerCase();
  const rows = (
    needle
      ? allRows.filter((r) =>
          [r.title, r.slug, r.tag].some((v) => v.toLowerCase().includes(needle)),
        )
      : allRows
  ).slice().sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "updated") return b.updated_at.localeCompare(a.updated_at);
    return a.position - b.position;
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(pageParam) || 1));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number) =>
    `/admin/content?s=${name}${query ? `&q=${encodeURIComponent(query)}` : ""}${sort !== "position" ? `&sort=${sort}` : ""}&page=${p}`;

  /* Every write action below ends with notify(...): it redirects back to the
     tab, search and page the staff member was on, tagging the outcome with an
     ok/err code that the popup below turns into plain words. Keeping the place
     matters — a Save on page 3 of menu_bar should land back on page 3, not on
     a collapsed list from the top. */
  function notify(kind: "ok" | "err", code: string): never {
    const p = new URLSearchParams();
    p.set("s", name);
    if (query) p.set("q", query);
    if (sort !== "position") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    p.set(kind, code);
    redirect(`/admin/content?${p.toString()}`);
  }

  /* The reverse of notify(): a code sitting in the URL becomes the popup's
     copy. No code, no popup. */
  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (err === "json") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — that JSON wouldn't parse. Keep the braces and quotes.";
  } else if (err === "menu") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — a menu row needs a price (a number).";
  } else if (err === "upload") {
    noticeTone = "err";
    noticeMessage = "Not uploaded — only JPEG, PNG or WebP, and under 2 MB.";
  } else if (err === "inuse") {
    noticeTone = "err";
    noticeMessage = "Not deleted — a row on the site uses that photo.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Added — it is live on the site.";
  } else if (ok === "uploaded") {
    noticeTone = "ok";
    noticeMessage = "Uploaded — the live site shows the new file.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Row deleted — it is gone from the site.";
  } else if (ok === "purged") {
    noticeTone = "ok";
    noticeMessage = "Photo deleted.";
  }

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
    let parsed: unknown;
    try {
      parsed = JSON.parse(extra);
    } catch {
      notify("err", "json");
    }

    /* Every menu row's price lives in `extra`, and /cuisine reads it straight
       out — a row without one renders as a bare "Rs." with nothing after it.
       Parseable is not enough here, so the shape is checked too. Optional
       chaining covers `null` and `7`, both of which parse fine and have no
       `.price` to read. */
    if (sec.startsWith("menu_") && typeof (parsed as { price?: unknown })?.price !== "number") {
      notify("err", "menu");
    }

    /* Resolved before the write, not fed from a RETURNING clause: auditedWrite
       batches the write and its audit row as one D1 transaction, and a batch
       cannot pass one statement's output into another's bindings. Also what
       tells "before" apart from "after" — no row means this is a create. */
    const existing = await env.DB.prepare(
      "SELECT * FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first();

    /* Mirrors the render condition on the checkbox below. If a second section
       ever grows a paid flag, both have to change together. */
    const paidValue = sec === "amenity" ? (formData.get("paid") ? 1 : 0) : null;
    const published = formData.get("published") ? 1 : 0;

    /* Insert-or-update in one statement: there is no separate "new row" screen,
       so this action serves both the blank form at the end of the list and every
       existing row above it. */
    /* `paid` is COALESCEd, not written flat: its checkbox only renders for
       amenities, and an unchecked box and an absent one look identical in a
       FormData. Binding the usual `? 1 : 0` would therefore have every save of a
       hero slide or a menu row quietly stamp 0 over whatever the column held.
       Null means "no opinion" — keep the stored value, and 0 on insert. */
    const write = env.DB.prepare(
      `INSERT INTO content (section, slug, position, title, tag, body, href, image, video, icon, extra, published, paid, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, 0), datetime('now'))
       ON CONFLICT (section, slug) DO UPDATE SET
         position = ?3, title = ?4, tag = ?5, body = ?6, href = ?7,
         image = ?8, video = ?9, icon = ?10, extra = ?11, published = ?12,
         paid = COALESCE(?13, paid),
         updated_at = datetime('now')`,
    ).bind(
      sec,
      slug,
      Number(get("position")) || 0,
      get("title"),
      get("tag"),
      get("body"),
      get("href"),
      get("image"),
      get("video"),
      get("icon"),
      extra,
      published,
      paidValue,
    );

    await auditedWrite(write, {
      actor: await getActor(),
      action: existing ? "content.update" : "content.create",
      section: sec,
      slug,
      before: existing ?? null,
      after: {
        position: Number(get("position")) || 0,
        title: get("title"),
        tag: get("tag"),
        body: get("body"),
        href: get("href"),
        image: get("image"),
        video: get("video"),
        icon: get("icon"),
        extra,
        published,
        paid: paidValue,
      },
    });
    notify("ok", existing ? "saved" : "added");
  }

  async function upload(formData: FormData) {
    "use server";
    await requireSession();

    const file = formData.get("file");
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    /* The file itself failed its checks — say so rather than doing nothing.
       Section/slug failures are defensive and stay silent. */
    if (!(file instanceof File) || !file.size || file.size > MAX) notify("err", "upload");
    if (!isSection(sec) || !slug) return;

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const match = MAGIC.find(([, , sig]) => sig.every((b, i) => head[i] === b));
    if (!match) notify("err", "upload");
    const [type, ext] = match;
    /* RIFF is also AVI and WAV. Only the WEBP fourcc makes it an image. */
    if (type === "image/webp" && String.fromCharCode(...head.slice(8, 12)) !== "WEBP") notify("err", "upload");

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

    const write = env.DB.prepare(
      "UPDATE content SET image = ?3, updated_at = datetime('now') WHERE section = ?1 AND slug = ?2",
    ).bind(sec, slug, `/img/${key}`);
    const { meta } = await auditedWrite(write, {
      actor: await getActor(),
      action: "content.update",
      section: sec,
      slug,
      before: { image: row.image },
      after: { image: `/img/${key}` },
    });
    /* The row vanished between the SELECT and the UPDATE: take the new blob
       back out, or it sits in the bucket forever with no row pointing at it. */
    if (!meta.changes) {
      await env.MEDIA.delete(key);
      return;
    }
    await dropOrphan(row.image);
    notify("ok", "uploaded");
  }

  /* Same shape as `upload`, but writes the `icon` column — and raster only, no
     SVG. SVG is markup rather than pixels, and R2 would serve it back as
     image/svg+xml, so any embedded <script> (or onload=, or an
     <a xlink:href="javascript:">) runs as this site's own origin the moment the
     file is opened directly. A regex blocklist cannot cover every vector, so the
     format is simply not accepted — a small PNG covers the same use case. */
  async function uploadIcon(formData: FormData) {
    "use server";
    await requireSession();

    const file = formData.get("file");
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    /* The file itself failed its checks — say so rather than doing nothing.
       Section/slug failures are defensive and stay silent. */
    if (!(file instanceof File) || !file.size || file.size > MAX) notify("err", "upload");
    if (!isSection(sec) || !slug) return;

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const match = MAGIC.find(([, , sig]) => sig.every((b, i) => head[i] === b));
    if (!match) notify("err", "upload");
    const [type, ext] = match;
    if (type === "image/webp" && String.fromCharCode(...head.slice(8, 12)) !== "WEBP") notify("err", "upload");

    const row = await env.DB.prepare(
      "SELECT icon FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first<{ icon: string }>();
    if (!row) return;

    const key = `${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });

    const write = env.DB.prepare(
      "UPDATE content SET icon = ?3, updated_at = datetime('now') WHERE section = ?1 AND slug = ?2",
    ).bind(sec, slug, `/img/${key}`);
    const { meta } = await auditedWrite(write, {
      actor: await getActor(),
      action: "content.update",
      section: sec,
      slug,
      before: { icon: row.icon },
      after: { icon: `/img/${key}` },
    });
    if (!meta.changes) {
      await env.MEDIA.delete(key);
      return;
    }
    await dropOrphan(row.icon);
    notify("ok", "uploaded");
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
    if (!stillUnused.some((o) => o.key === key)) notify("err", "inuse");
    await env.MEDIA.delete(key);
    /* No D1 row involved — logAudit-only, no auditedWrite batch to pair it
       with. content.delete_unused still gets an alert like every other
       delete, since it is still a destructive action on real storage. */
    const actor = await getActor();
    await env.DB.prepare(
      `INSERT INTO audit_log (actor, action, section, slug, before, after)
       VALUES (?1, 'content.delete_unused', NULL, ?2, NULL, NULL)`,
    )
      .bind(actor, key)
      .run();
    notify("ok", "purged");
  }

  async function removeItem(formData: FormData) {
    "use server";
    await requireSession();
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!isSection(sec) || !slug) return;

    /* Resolved before the write, same reason as saveItem: a D1 batch can't
       feed a DELETE ... RETURNING's output into the audit-log INSERT that
       rides along with it in the same transaction. */
    const row = await env.DB.prepare(
      "SELECT * FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first<{ image: string; icon: string; video: string }>();
    if (!row) return;

    const write = env.DB.prepare(
      "DELETE FROM content WHERE section = ?1 AND slug = ?2",
    ).bind(sec, slug);
    await auditedWrite(write, {
      actor: await getActor(),
      action: "content.delete",
      section: sec,
      slug,
      before: row,
      after: null,
    });

    /* dropOrphan is a no-op for anything not under /img/, so the empty columns
       and the seeded /media/ paths cost a string check each and nothing more. */
    for (const file of [row.image, row.icon, row.video]) await dropOrphan(file);
    notify("ok", "deleted");
  }

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Pages, rooms &amp; photos</h1>
      <p className="adm-sub">{TITLES[name]}</p>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

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

      <div className="adm-toolbar">
        {/* Plain GET, no JS: typing a term and pressing Enter (or the button)
            reloads this page filtered. It works with the browser back button
            and a bookmarked search, which a client-side filter would not. */}
        <form className="adm-search" action="/admin/content">
          <input type="hidden" name="s" value={name} />
          <input
            type="search"
            name="q"
            placeholder="Search title, slug or tag…"
            defaultValue={query}
          />
          {sort !== "position" && <input type="hidden" name="sort" value={sort} />}
          <button type="submit">Search</button>
        </form>
        <div className="adm-sort">
          <span>Sort:</span>
          {SORTS.map((sv) => (
            <Link
              key={sv}
              href={`/admin/content?s=${name}${query ? `&q=${encodeURIComponent(query)}` : ""}&sort=${sv}`}
              aria-current={sv === sort ? "page" : undefined}
            >
              {SORT_LABEL[sv]}
            </Link>
          ))}
        </div>
      </div>

      <p className="adm-count">
        {rows.length} {rows.length === 1 ? "item" : "items"}
        {query && <> matching “{query}”</>}
        {totalPages > 1 && <> — page {page} of {totalPages}</>}
      </p>

      {pageRows.map((row) => (
        /* Collapsed by default: a summary line carries enough to recognise the
           row without opening it, so this screen is a scannable list first and
           a form only on demand — not every form unrolled at once. */
        <details key={row.slug} className="adm-row">
          <summary className="adm-summary">
            {row.image ? (
              <img className="adm-thumb" src={row.image} alt="" loading="lazy" />
            ) : (
              <span className="adm-thumb adm-thumb--empty" aria-hidden="true" />
            )}
            <span className="adm-summary-main">
              <span className="adm-summary-title">{row.title || row.slug}</span>
              <span className="adm-summary-meta">
                {row.slug}
                {row.tag && <span className="badge">{row.tag}</span>}
              </span>
            </span>
            <span className={`badge ${row.published ? "badge--on" : "badge--off"}`}>
              {row.published ? "shown" : "hidden"}
            </span>
            <span className="adm-summary-updated">
              {row.updated_at ? row.updated_at.slice(0, 10) : ""}
            </span>
          </summary>

          {/* The upload is a sibling form, not a nested one — a <form> inside a
              <form> is invalid HTML and browsers silently drop the inner one. */}
          <form className="adm-item" action={saveItem}>
            <input type="hidden" name="section" value={name} />

            <div className="adm-row3">
              <div className="adm-field">
                <label>slug</label>
                {/* Read-only on an existing row: (section, slug) is the primary
                    key, so editing it here would silently create a duplicate
                    rather than rename. Renaming is delete-then-add, which is
                    also what makes an orphaned image obvious. */}
                <input name="slug" defaultValue={row.slug} required readOnly />
              </div>

              <div className="adm-field">
                <label>order</label>
                {/* The row's stored position, never its index in this list.
                    They agree only while a section is numbered densely; the
                    amenity seed is not, so an index here meant that saving a
                    row — with no edit to this box at all — rewrote its place
                    in the list and moved the card. */}
                <input name="position" type="number" defaultValue={row.position} />
              </div>

              <label className="adm-check adm-check--inline">
                <input name="published" type="checkbox" defaultChecked={row.published === 1} />
                <span>Show on the site</span>
              </label>
            </div>

            <div className="adm-field">
              <label>title</label>
              <input name="title" defaultValue={row.title} />
            </div>

            <div className="adm-field">
              <label>tag</label>
              <input name="tag" defaultValue={row.tag} />
              <small>
                {name === "amenity"
                  ? "Category (e.g. Bathroom, Kitchen, Safety & security)."
                  : "The small line above or beside the title."}
              </small>
            </div>

            <div className="adm-field">
              <label>body</label>
              <textarea name="body" rows={3} defaultValue={row.body} />
            </div>

            {fields.href && (
              <div className="adm-field">
                <label>href</label>
                <input name="href" defaultValue={row.href} />
              </div>
            )}

            {fields.image && (
              <div className="adm-field">
                <label>image</label>
                <input name="image" defaultValue={row.image} />
                <small>A path like /media/rooms/deluxe-king.jpg</small>
              </div>
            )}

            {fields.video && (
              <div className="adm-field">
                <label>video</label>
                <input name="video" defaultValue={row.video} />
              </div>
            )}

            {fields.icon && (
              <div className="adm-field">
                <label>icon</label>
                <input name="icon" defaultValue={row.icon} />
                <small>A path like /img/&lt;uuid&gt;.png — set by the icon upload below.</small>
              </div>
            )}

            {fields.paid && (
              <label className="adm-check">
                <input name="paid" type="checkbox" defaultChecked={row.paid === 1} />
                <span>Paid / additional charge</span>
              </label>
            )}

            {fields.extra && (
              <div className="adm-field">
                <label>extra (JSON)</label>
                <textarea name="extra" rows={2} defaultValue={JSON.stringify(row.extra)} />
                <small>
                  {name.startsWith("menu_")
                    ? "Keep the braces and quotes, and keep a number in price — a menu row without one is not saved."
                    : "Keep the braces and quotes. If they are wrong, nothing is saved."}
                </small>
              </div>
            )}

            {/* Not shown when the section has no such field, but still written
                on every save so a row created before FIELDS existed keeps
                whatever it already had rather than being blanked. */}
            {!fields.image && <input type="hidden" name="image" value={row.image} />}
            {!fields.href && <input type="hidden" name="href" value={row.href} />}
            {!fields.video && <input type="hidden" name="video" value={row.video} />}
            {!fields.icon && <input type="hidden" name="icon" value={row.icon} />}
            {!fields.extra && <input type="hidden" name="extra" value={JSON.stringify(row.extra)} />}

            <button type="submit">Save</button>
          </form>

          {fields.image && (
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

          {fields.icon && (
            <form action={uploadIcon} encType="multipart/form-data" className="adm-upload">
              <input type="hidden" name="section" value={name} />
              <input type="hidden" name="slug" value={row.slug} />
              <label>icon</label>
              <input type="file" name="file" accept="image/png,image/webp,image/jpeg" required />
              <button type="submit">Upload icon</button>
              <small>PNG, WebP or JPEG (no SVG — see the comment in this file). It replaces the icon path above.</small>
            </form>
          )}
        </details>
      ))}

      {totalPages > 1 && (
        <nav className="adm-pager">
          {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && <Link href={pageHref(page + 1)}>Next →</Link>}
        </nav>
      )}

      {/* The blank row that adds a new item. Always open, and separate from the
          list above it, so it reads as "start something new" rather than as one
          more collapsed card to notice among the rest. */}
      <details className="adm-row adm-row--new" open>
        <summary className="adm-summary">+ Add new</summary>
        <form className="adm-item" action={saveItem}>
          <input type="hidden" name="section" value={name} />

          <div className="adm-row3">
            <div className="adm-field">
              <label>slug</label>
              <input name="slug" required />
              <small>A short name, lowercase, no spaces. It cannot be changed later.</small>
            </div>
            <div className="adm-field">
              <label>order</label>
              <input name="position" type="number" defaultValue={nextPosition} />
              <small>Lowest first.</small>
            </div>
            <label className="adm-check adm-check--inline">
              <input name="published" type="checkbox" defaultChecked />
              <span>Show on the site</span>
            </label>
          </div>

          <div className="adm-field">
            <label>title</label>
            <input name="title" />
          </div>

          <div className="adm-field">
            <label>tag</label>
            <input name="tag" />
            <small>
              {name === "amenity"
                ? "Category (e.g. Bathroom, Kitchen, Safety & security)."
                : "The small line above or beside the title."}
            </small>
          </div>

          <div className="adm-field">
            <label>body</label>
            <textarea name="body" rows={3} />
          </div>

          {fields.href && (
            <div className="adm-field">
              <label>href</label>
              <input name="href" />
            </div>
          )}

          {fields.image && (
            <div className="adm-field">
              <label>image</label>
              <input name="image" />
              <small>A path like /media/rooms/deluxe-king.jpg. Photo upload happens after adding.</small>
            </div>
          )}

          {fields.video && (
            <div className="adm-field">
              <label>video</label>
              <input name="video" />
            </div>
          )}

          {fields.icon && (
            <div className="adm-field">
              <label>icon</label>
              <input name="icon" />
            </div>
          )}

          {fields.paid && (
            <label className="adm-check">
              <input name="paid" type="checkbox" />
              <span>Paid / additional charge</span>
            </label>
          )}

          {fields.extra && (
            <div className="adm-field">
              <label>extra (JSON)</label>
              {/* A blank menu row starts with a price rather than {}, because a
                  menu row without one is refused by saveItem — and a form that
                  pre-fills the thing it will then reject is a trap. */}
              <textarea
                name="extra"
                rows={2}
                defaultValue={JSON.stringify(name.startsWith("menu_") ? { price: 0 } : {})}
              />
              <small>
                {name.startsWith("menu_")
                  ? "Keep the braces and quotes, and keep a number in price — a menu row without one is not saved."
                  : "Keep the braces and quotes. If they are wrong, nothing is saved."}
              </small>
            </div>
          )}

          {!fields.image && <input type="hidden" name="image" value="" />}
          {!fields.href && <input type="hidden" name="href" value="" />}
          {!fields.video && <input type="hidden" name="video" value="" />}
          {!fields.icon && <input type="hidden" name="icon" value="" />}
          {!fields.extra && <input type="hidden" name="extra" value="{}" />}

          <button type="submit">Add</button>
        </form>
      </details>

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

      {pageRows.length > 0 && (
        <div className="adm-danger">
          <h2>Delete</h2>
          <p>There is no undo. A deleted row is gone from the site immediately.</p>
          {pageRows.map((row) => (
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

import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { auditedWrite } from "@/lib/audit";
import AdminNotice from "@/components/AdminNotice";
import PhotoPicker from "@/components/PhotoPicker";
import SubmitButton from "@/components/SubmitButton";
import { section } from "@/lib/content";
import { bankItems } from "@/lib/media-store";

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
  /* No "amenity" and no "menu_*": both moved to screens of their own, where an
     amenity is ticked into the highlights grid and a drink is one row holding
     its pours. Neither can come back here — this screen rebuilds `extra` from
     the boxes it draws, and it draws none of theirs. */
  /* Nor "menu_*": the four menu sections moved to /admin/menu, where a
     drink is one row holding its pours rather than four rows with four slugs.
     They cannot come back here — this screen rebuilds `extra` from the boxes it
     draws, and the one Price box it drew would throw a drink's sizes away. */
] as const;
type Section = (typeof SECTIONS)[number];

const isSection = (value: string): value is Section => SECTIONS.includes(value as Section);

/* Module-level, not a closure inside the page component: a "use server" action
   below is hoisted to the top of the module and its captured free variables
   get serialized so the hoisted copy can rebuild them. A *function* value
   can't be serialized that way — closing over a local notify() helper (as
   this used to) throws "Functions cannot be passed directly to Client
   Components" the moment the action is rendered. name/query/sort/page stay
   as plain closed-over values (strings/numbers serialize fine); only the
   helper itself had to move out to stop being one. */
function contentRedirect(
  name: Section,
  query: string,
  sort: Sort,
  page: number,
  kind: "ok" | "err",
  code: string,
): never {
  const p = new URLSearchParams();
  p.set("s", name);
  if (query) p.set("q", query);
  if (sort !== "position") p.set("sort", sort);
  if (page > 1) p.set("page", String(page));
  p.set(kind, code);
  redirect(`/admin/content?${p.toString()}`);
}

/* Column names are generic because one table serves six sections. On this screen
   they need to read as the thing being edited. */
const TITLES: Record<Section, string> = {
  hero: "Home — the big slides",
  service: "Home — the small cards",
  room: "Rooms",
  gallery: "Gallery photos",
};

/* Short enough to sit in a row of tabs — TITLES above is the full sentence
   shown once, under the heading. */
const TAB_LABEL: Record<Section, string> = {
  hero: "Home slides",
  service: "Home cards",
  room: "Rooms",
  gallery: "Gallery",
};

/* What each tab actually is, in the words someone who has never seen this
 * screen would use, plus a sketch of where on the public site it lands.
 *
 * The sentence alone was tried and is not enough: "hero" and "service" both
 * describe things on the home page, and the difference between them is
 * positional. A picture of the page with one band lit answers that in less time
 * than a paragraph does, and it is the same answer for a member of staff who
 * reads English slowly. */
type Sketch = { page: string; blocks: string[]; lit: number };
const EXPLAIN: Record<Section, { what: string; sketch: Sketch }> = {
  hero: {
    what: "The big photographs that slide across the top of the home page, each with a line of text over it. This is the first thing a guest sees.",
    sketch: { page: "Home", blocks: ["Big slides", "Small cards", "Rooms strip"], lit: 0 },
  },
  service: {
    what: "The small cards under the slides on the home page — the short boxes that say what the hotel offers. Each one can link somewhere.",
    sketch: { page: "Home", blocks: ["Big slides", "Small cards", "Rooms strip"], lit: 1 },
  },
  room: {
    what: "The room types on the Rooms page. Each row here is one room card, with its guest count, its highlights and its list of specs.",
    sketch: { page: "Rooms", blocks: ["Room cards", "Booking panel"], lit: 0 },
  },
  gallery: {
    what: "The photographs and clips in the grid on the Gallery page. A row can hold a photo, a clip, or a photo with a clip behind it.",
    sketch: { page: "Gallery", blocks: ["Photo & clip grid"], lit: 0 },
  },
};

/* Inline SVG rather than a diagram library or nine hand-drawn files: it is four
   rectangles and a caption, it inherits the console's own colours, and there is
   nothing to keep in sync when a tab is renamed. */
function PageSketch({ page, blocks, lit }: Sketch) {
  const H = 20;
  const GAP = 5;
  const TOP = 20;
  const height = TOP + blocks.length * (H + GAP) + 4;
  return (
    <svg
      className="adm-sketch"
      viewBox={`0 0 220 ${height}`}
      role="img"
      aria-label={`Where this appears on the ${page} page`}
    >
      <rect x="0.5" y="0.5" width="219" height={height - 1} fill="#fff" stroke="#b8bcc0" />
      <rect x="1" y="1" width="218" height="13" fill="#e6e8ea" />
      <text x="7" y="10.5" fontSize="7.5" fill="#5a6169">
        {page} page
      </text>
      {blocks.map((b, n) => (
        <g key={b}>
          <rect
            x="10"
            y={TOP + n * (H + GAP)}
            width="200"
            height={H}
            fill={n === lit ? "#1c7a3e" : "#eef0f1"}
            stroke={n === lit ? "#1c7a3e" : "#c9ced2"}
          />
          <text
            x="18"
            y={TOP + n * (H + GAP) + 13.5}
            fontSize="8.5"
            fill={n === lit ? "#fff" : "#5a6169"}
          >
            {b}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* What travels in `extra` for the room section — mirrors app/rooms/page.tsx.
   `sizeValue` is written by /admin/settings, not here: the size belongs with the
   other two rooms' sizes so all three can be compared and the smallest can set
   the hotel-wide line. It is listed so this screen's extra-JSON round trip
   preserves it rather than dropping a field it does not know about. */
type RoomExtra = {
  count: string;
  meta: string[];
  specs: [string, string][];
  sizeValue?: string;
};

/* Which of the generic columns a section's own page actually reads — checked
   against every page in app/ that calls section(). A field no page reads is a
   blank box on this screen for every single row, so it is left off the form
   entirely rather than shown empty: href only feeds the home page's small
   cards, video only the gallery, icon and paid only amenities, and extra only
   rooms (count/meta/specs). */
const FIELDS: Record<
  Section,
  { image?: true; href?: true; video?: true; extra?: true }
> = {
  hero: { image: true },
  service: { image: true, href: true },
  room: { image: true, extra: true },
  gallery: { image: true, video: true },
};

/* Sections whose list of rows is the page's own shape, not a collection.
   The home cards and the room types are each drawn by a layout built around
   the rows that exist — a card strip, a fanned 3D carousel — and a row added
   or removed here changes that layout rather than adding an entry to a list.
   Both are edited freely; neither is added to or deleted from. The gallery
   and the hero slides are collections and stay open. Enforced in saveItem and
   removeItem too, not just by drawing fewer buttons: a hand-crafted POST
   reaches the same actions. */
const FIXED: readonly Section[] = ["service", "room"];

const SORTS = ["position", "title", "updated"] as const;
type Sort = (typeof SORTS)[number];
const isSort = (value: string): value is Sort => (SORTS as readonly string[]).includes(value);
const SORT_LABEL: Record<Sort, string> = { position: "Order", title: "Title", updated: "Recently updated" };

/* A <details> per row is a full <form> with a dozen fields, so a tab that grows
   past a screenful gets heavy to load and scroll. The 68-row amenity tab is what
   forced this and it has its own screen now, but the gallery is the next one to
   get there. Paged the same way search and sort already are: through the URL, no
   client state. */
const PAGE_SIZE = 40;

export default async function Content({
  searchParams,
}: {
  searchParams: Promise<{
    s?: string;
    q?: string;
    sort?: string;
    page?: string;
    ok?: string;
    err?: string;
  }>;
}) {
  const session = await requireSession();
  /* Read once for the render; every delete action re-asks at the moment of the
     write, because a grant can expire while this page is open. */
  const canDelete = (await can(session, "content.delete")).allowed;
  const { s, q, sort: sortParam, page: pageParam, ok, err } = await searchParams;
  const name: Section = s && isSection(s) ? s : "hero";
  const query = (q ?? "").trim();
  const sort: Sort = sortParam && isSort(sortParam) ? sortParam : "position";
  const fields = FIELDS[name];
  const fixed = FIXED.includes(name);

  /* true = include unpublished. Without it the "Show on the site" checkbox is a
     one-way door: unticking a row drops it out of this list too. */
  const allRows = await section(name, true);
  /* The whole bank, once, for every picker on the page — one query rather than
     one per row. Every section left on this screen shows a photo, a clip or an
     icon, so there is no tab that would pay for a scan it never reads. */
  const bank = await bankItems();
  /* Ten past the last row, not `rows.length`. Positions are sparse on purpose —
     the amenity seed, which taught this the hard way, ran to 181 across 68 rows
     with gaps between categories — so a count would drop every new row into the
     middle of the list instead of the end. The gap of ten also leaves room to slot a row between
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

  /* Every write action below ends with a contentRedirect(...) call: it
     redirects back to the tab, search and page the staff member was on,
     tagging the outcome with an ok/err code that the popup below turns into
     plain words. Keeping the place matters — a Save on page 2 of a long tab
     should land back on page 2, not on a collapsed list from the top. Each
     action closes over name/query/sort/page (plain values, fine to
     serialize) and calls the module-level helper directly rather than
     through a local wrapper — see the comment on contentRedirect itself for
     why a wrapper function can't sit in between. */

  /* The reverse of that: a code sitting in the URL becomes the popup's
     copy. No code, no popup. */
  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (err === "json") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — that JSON wouldn't parse. Keep the braces and quotes.";
  } else if (err === "perm") {
    noticeTone = "err";
    noticeMessage =
      "Nothing was deleted — deleting is the developer's, and an owner needs access granted for it. Everything else on this page is yours to edit.";
  } else if (err === "fixed") {
    noticeTone = "err";
    noticeMessage =
      "Nothing changed — home cards and room types can be edited, but not added or removed. That is a change to the shape of the page, so it goes through the developer.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Added — it is live on the site.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Row deleted — it is gone from the site.";
  }

  async function saveItem(formData: FormData) {
    "use server";
    await requireSession();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const sec = get("section");
    const slug = get("slug");
    if (!isSection(sec) || !slug) return;

    /* room is the only section FIELDS marks extra:true for, and it has its own
       plain-language inputs below rather than a raw JSON textarea — this builds
       the same column from them. Every other section carries its existing
       `extra` forward unedited via a hidden field, still JSON-checked since
       that hidden value is still attacker-reachable through a hand-crafted POST
       to this action. */
    let extra: string;
    if (sec === "room") {
      const meta = get("meta")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const specs = get("specs")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line): [string, string] => {
          const i = line.indexOf(":");
          return i < 0 ? [line, ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        });
      /* Carried through untouched from the hidden field below. This screen
         rebuilds `extra` from its own inputs rather than merging, so a field it
         has no box for is a field it would silently delete — and the room sizes
         are edited on /admin/settings, where all three sit together. Still
         re-checked here, because a hidden input is reachable by a hand-crafted
         POST like any other. */
      const sizeValue = get("sizeValue");
      extra = JSON.stringify({
        count: get("count"),
        meta,
        specs,
        sizeValue: /^\d+(\.\d+)?$/.test(sizeValue) ? sizeValue : "",
      });
    } else {
      const raw = get("extra") || "{}";
      try {
        JSON.parse(raw);
      } catch {
        contentRedirect(name, query, sort, page, "err", "json");
      }
      extra = raw;
    }

    /* Resolved before the write, not fed from a RETURNING clause: auditedWrite
       batches the write and its audit row as one D1 transaction, and a batch
       cannot pass one statement's output into another's bindings. Also what
       tells "before" apart from "after" — no row means this is a create. */
    const existing = await env.DB.prepare(
      "SELECT * FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first<{ image: string; video: string; icon: string }>();

    /* An edit of a row that exists is always fine; only the create is refused. */
    if (!existing && FIXED.includes(sec)) {
      contentRedirect(name, query, sort, page, "err", "fixed");
    }

    const published = formData.get("published") ? 1 : 0;

    /* Insert-or-update in one statement: there is no separate "new row" screen,
       so this action serves both the blank form at the end of the list and every
       existing row above it. */
    /* `paid` is COALESCEd, not written flat: its checkbox only renders for
       amenities, and an unchecked box and an absent one look identical in a
       FormData. Binding the usual `? 1 : 0` would therefore have every save of a
       hero slide or a room quietly stamp 0 over whatever the column held.
       Null means "no opinion" — keep the stored value, and 0 on insert. */
    const write = env.DB.prepare(
      `INSERT INTO content (section, slug, position, title, tag, body, href, image, video, icon, extra, published, paid, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, datetime('now'))
       ON CONFLICT (section, slug) DO UPDATE SET
         position = ?3, title = ?4, tag = ?5, body = ?6, href = ?7,
         image = ?8, video = ?9, icon = ?10, extra = ?11, published = ?12,
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
      },
    });

    contentRedirect(name, query, sort, page, "ok", existing ? "saved" : "added");
  }

  async function removeItem(formData: FormData) {
    "use server";
    if (!(await can(await requireSession(), "content.delete")).allowed) {
      contentRedirect(name, query, sort, page, "err", "perm");
    }
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!isSection(sec) || !slug) return;
    if (FIXED.includes(sec)) {
      contentRedirect(name, query, sort, page, "err", "fixed");
    }

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

    contentRedirect(name, query, sort, page, "ok", "deleted");
  }

  /* One definition, two callers: the edit row and the add-new form ask for the
     same boxes and used to carry two copies of them, which is how the photo
     path came to be pasted twice and the "Advanced" disclosure came to hide it
     in both. `row` undefined means the blank form. */
  const detailFields = (row?: (typeof pageRows)[number]) => {
    const extra = row?.extra as unknown as RoomExtra | null;
    return (
      <>
        <div className="adm-con-field adm-con-wide">
          <label>Title</label>
          <input name="title" defaultValue={row?.title ?? ""} />
        </div>

        <div className="adm-con-field adm-con-wide">
          <label>Label</label>
          <input name="tag" defaultValue={row?.tag ?? ""} />
          <small>
"The small line above or beside the title."
          </small>
        </div>

        <div className="adm-con-field adm-con-wide">
          <label>Description</label>
          <textarea name="body" rows={3} defaultValue={row?.body ?? ""} />
        </div>

        {fields.extra && name === "room" && (
          <>
            {/* A brand-new room has no size yet — it gets one on
                /admin/settings, alongside the other two. */}
            <input type="hidden" name="sizeValue" value={extra?.sizeValue ?? ""} />
            <div className="adm-con-field">
              <label>Guests</label>
              <input name="count" defaultValue={extra?.count ?? ""} />
            </div>
            <div className="adm-con-field adm-con-wide">
              <label>Highlights</label>
              <textarea name="meta" rows={3} defaultValue={(extra?.meta ?? []).join("\n")} />
              <small>One line per point.</small>
            </div>
            <div className="adm-con-field adm-con-wide">
              <label>Specs</label>
              <textarea
                name="specs"
                rows={3}
                defaultValue={(extra?.specs ?? []).map(([l, v]) => `${l}: ${v}`).join("\n")}
              />
              <small>One per line, as &ldquo;Label: value&rdquo;.</small>
            </div>
          </>
        )}

      </>
    );
  };

  /* The photo, clip and icon controls. Every one of them used to be a text box
     behind a disclosure marked "Advanced", which asked staff to know a file path
     — the single loudest complaint about this screen. */
  const mediaFields = (row?: (typeof pageRows)[number]) => (
    <>
      {fields.image && (
        <PhotoPicker
          name="image"
          label="Photo"
          kind="photo"
          items={bank}
          defaultValue={row?.image ?? ""}
          hint="Pick one from the bank. To add a new one, use the Photo bank screen."
        />
      )}
      {fields.video && (
        <PhotoPicker
          name="video"
          label="Clip"
          kind="video"
          items={bank}
          defaultValue={row?.video ?? ""}
          hint="Optional. A clip plays behind the photo in the gallery."
        />
      )}
      {fields.href && (
        <div className="adm-con-field adm-con-wide">
          <label>Where the card goes when it is clicked</label>
          <input name="href" defaultValue={row?.href ?? ""} placeholder="/rooms" />
          <small>A page on this site, like /rooms or /cuisine. Leave empty for no link.</small>
        </div>
      )}
    </>
  );

  /* Written on every save even when the section has no such box, so a row
     created before FIELDS existed keeps what it already had rather than being
     blanked by a form that never showed it. */
  const carried = (row?: (typeof pageRows)[number]) => (
    <>
      {!fields.image && <input type="hidden" name="image" value={row?.image ?? ""} />}
      {!fields.href && <input type="hidden" name="href" value={row?.href ?? ""} />}
      {!fields.video && <input type="hidden" name="video" value={row?.video ?? ""} />}
      {/* No section here has an icon box any more — the one that did is now
          /admin/amenities, and it looks its symbol up from the category. Carried
          so a row that still holds one is not blanked by a save. */}
      <input type="hidden" name="icon" value={row?.icon ?? ""} />
      {!fields.extra && (
        <input type="hidden" name="extra" value={JSON.stringify(row?.extra ?? {})} />
      )}
    </>
  );

  return (
    <div className="adm-page adm-con">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Pages, rooms &amp; photos</h1>
      {/* A <div>, not the <p> it was: a <details> is flow content and a browser
          closes an open <p> the moment it meets one, which put the help panel
          outside the subtitle it belongs to. */}
      <div className="adm-sub">
        {TITLES[name]}
        <details className="adm-con-help">
          <summary aria-label={`What ${TAB_LABEL[name]} means`}>?</summary>
          <div className="adm-con-help-body adm-explain">
            <p>{EXPLAIN[name].what}</p>
            <PageSketch {...EXPLAIN[name].sketch} />
          </div>
        </details>
      </div>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

      <nav className="adm-tabs">
        {SECTIONS.map((x) => (
          <Link
            key={x}
            href={`/admin/content?s=${x}`}
            aria-current={x === name ? "page" : undefined}
          >
            {TAB_LABEL[x]}
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
            placeholder="Search title, short name or label…"
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
        {" · "}
        {/* Where photos come from and go. The "check for unused photos" sweep
            that used to sit here is gone: it deleted R2 objects that the
            content table did not reference, which was correct while every
            upload belonged to one card, and wrong the moment the bank made a
            photo a thing in its own right — an unused one is a photo waiting to
            be used, and the bank is where it is seen and, if it really is
            finished with, deleted. */}
        <Link href="/admin/photos">Add or remove photos in the bank</Link>
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

          <form className="adm-item" action={saveItem}>
            <input type="hidden" name="section" value={name} />

            <div className="adm-con-grid">
              <div className="adm-con-field">
                <label>Short name</label>
                {/* Read-only on an existing row: (section, slug) is the primary
                    key, so editing it here would silently create a duplicate
                    rather than rename. Renaming is delete-then-add, which is
                    also what makes an orphaned image obvious. */}
                <input name="slug" defaultValue={row.slug} required readOnly />
              </div>

              <div className="adm-con-field">
                <label>Order</label>
                {/* The row's stored position, never its index in this list.
                    They agree only while a section is numbered densely; the
                    amenity seed is not, so an index here meant that saving a
                    row — with no edit to this box at all — rewrote its place
                    in the list and moved the card. */}
                <input name="position" type="number" defaultValue={row.position} />
                <small>Lowest first.</small>
              </div>

              <label className="adm-con-tick">
                <input name="published" type="checkbox" defaultChecked={row.published === 1} />
                <span>Show on the site</span>
              </label>

              {detailFields(row)}
              {mediaFields(row)}
            </div>

            {carried(row)}

            <div className="adm-item-bar">
              <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Saving…">
                Save
              </SubmitButton>
            </div>
          </form>

          {/* Item 4: the delete for this row lives on this row, and is its own
              form — a <form> inside a <form> is invalid HTML and browsers
              silently drop the inner one. It used to sit in one stack at the
              bottom of the page labelled "Delete <slug>", which made deleting
              the wrong thing a matter of misreading one of forty near-identical
              short names. The disclosure is the two-step confirm: no JavaScript,
              and it cannot be armed on the way past to Save. */}
          {fixed ? (
            <p className="adm-item-locked">
              This one cannot be deleted here — untick &ldquo;Show on the site&rdquo; to take it
              off the site and keep it.
            </p>
          ) : canDelete ? (
            <details className="adm-item-danger">
              <summary>Delete this one…</summary>
              <form action={removeItem}>
                <input type="hidden" name="section" value={name} />
                <input type="hidden" name="slug" value={row.slug} />
                <p>
                  Delete <b>{row.title || row.slug}</b>? It goes from the site immediately, and
                  there is no undo.
                </p>
                <SubmitButton type="submit" className="adm-btn adm-btn--bad" pendingText="Deleting…">
                  Yes, delete it
                </SubmitButton>
              </form>
            </details>
          ) : (
            <p className="adm-item-locked">
              Deleting is the developer&rsquo;s. An owner can be given it for 24 hours — ask them.
              Everything else here is yours to change.
            </p>
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

      {/* Item 6: adding something new is a sequence, not a blank clone of the
          edit row. Numbered steps in the order the questions actually occur —
          what is it, what does it say, what does it look like, where does it go
          — so nobody has to work out which of a dozen boxes is the required
          one. The <ol> numbers itself, so a section with no photo field simply
          has three steps rather than a gap where step 3 was. */}
      {fixed ? (
        <p className="adm-item-locked">
          {name === "room" ? "Room types are" : "The home cards are"} fixed — edit the ones
          above as much as you like. Adding one changes how the page is built, so it goes
          through the developer.
        </p>
      ) : (
      <fieldset className="adm-con-panel adm-new">
        <legend>Add a new one</legend>
        <form className="adm-item" action={saveItem}>
          <input type="hidden" name="section" value={name} />
          <ol className="adm-steps">
            <li>
              <b>Name it</b>
              <div className="adm-con-grid">
                <div className="adm-con-field">
                  <label>Short name</label>
                  <input name="slug" required placeholder="deluxe-king" />
                  <small>Lowercase, no spaces. It cannot be changed later.</small>
                </div>
                <div className="adm-con-field adm-con-wide">
                  <label>Title</label>
                  <input name="title" />
                </div>
              </div>
            </li>

            <li>
              <b>Say what it is</b>
              <div className="adm-con-grid">
                <div className="adm-con-field adm-con-wide">
                  <label>Label</label>
                  <input name="tag" />
                  <small>
"The small line above or beside the title."
                  </small>
                </div>
                <div className="adm-con-field adm-con-wide">
                  <label>Description</label>
                  <textarea name="body" rows={3} />
                </div>
                {fields.extra && name === "room" && (
                  <>
                    <input type="hidden" name="sizeValue" value="" />
                    <div className="adm-con-field">
                      <label>Guests</label>
                      <input name="count" />
                    </div>
                    <div className="adm-con-field adm-con-wide">
                      <label>Highlights</label>
                      <textarea name="meta" rows={3} />
                      <small>One line per point.</small>
                    </div>
                    <div className="adm-con-field adm-con-wide">
                      <label>Specs</label>
                      <textarea name="specs" rows={3} />
                      <small>One per line, as &ldquo;Label: value&rdquo;.</small>
                    </div>
                  </>
                )}
              </div>
            </li>

            <li>
              <b>Choose its picture</b>
              <div className="adm-con-grid">{mediaFields()}</div>
            </li>

            <li>
              <b>Put it in place</b>
              <div className="adm-con-grid">
                <div className="adm-con-field">
                  <label>Order</label>
                  <input name="position" type="number" defaultValue={nextPosition} />
                  <small>Lowest first. This lands it at the end.</small>
                </div>
                <label className="adm-con-tick">
                  <input name="published" type="checkbox" defaultChecked />
                  <span>Show on the site</span>
                </label>
              </div>
            </li>
          </ol>

          {carried()}

          <div className="adm-item-bar">
            <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Adding…">
              Add it
            </SubmitButton>
          </div>
        </form>
      </fieldset>
      )}

    </div>
  );
}

import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { auditedWrite } from "@/lib/audit";
import AdminNotice from "@/components/AdminNotice";
import SubmitButton from "@/components/SubmitButton";
import { section } from "@/lib/content";
import { CATEGORIES, TOUCH_NAMES, composeAmenityExtra, type AmenityExtra } from "@/lib/amenities";
import AmenityGlyph from "@/components/AmenityGlyph";
import TouchGlyph from "@/components/TouchGlyph";

export const dynamic = "force-dynamic";

/* The guest-facing amenities list, on its own screen.
 *
 * It used to be a tab on /admin/content, editing the same generic row that a
 * menu item and a room use — a Price box and a Photo box bolted onto a form
 * built for something else. That worked until migration 0023 gave amenities
 * their own two feature strips: a highlights grid near the top of the public
 * page and a "little touches" row below it. The generic editor had nowhere to
 * put those, and saving a row there would have silently dropped them the same
 * way it once dropped drink sizes.
 *
 * So the amenity rows are gone from that screen and live here, grouped under
 * the categories the public page itself uses. Deleting is the same capability
 * and the same re-check inside the action — a form that isn't drawn is not a
 * permission. */

/* One section, one row set. There are no tabs because there is nothing to tab
   across — amenities print as a single list on the public page. The section
   name is a literal, not a constant to choose from, because the form that
   edits an amenity never edits anything else. */
const SECTION = "amenity";

/* Module-level for the same reason menuRedirect is: a "use server" action is
   hoisted out of the component, and a captured function value cannot be
   serialized to follow it. Plain strings can, so the search term is fine to
   close over. */
function amenityRedirect(
  query: string,
  kind: "ok" | "err",
  code: string,
): never {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  p.set(kind, code);
  redirect(`/admin/amenities?${p.toString()}`);
}

export default async function Amenities({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; err?: string }>;
}) {
  const session = await requireSession();
  /* Read once for the render; the action re-asks at the moment of the write,
     because a grant can expire while this page is open. */
  const canDelete = (await can(session, "content.delete")).allowed;
  const { q, ok, err } = await searchParams;
  const query = (q ?? "").trim();

  /* true = include unpublished, or taking an amenity out of public view for
     maintenance would also take it out of this editor and there would be no
     way to put it back. */
  const allRows = await section<AmenityExtra>(SECTION, true);

  const needle = query.toLowerCase();
  const rows = needle
    ? allRows.filter((r) => [r.title, r.slug, r.tag].some((v) => v.toLowerCase().includes(needle)))
    : allRows;

  /* Grouped by category, in the order the rows already sit in — the same
     `position` order the public page uses, so the two lists read the same
     way. */
  const groups: { tag: string; items: typeof rows }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.tag === row.tag) last.items.push(row);
    else groups.push({ tag: row.tag, items: [row] });
  }

  /* Offered on the "Add a new one" form so a new amenity joins a category
     that already exists rather than inventing "Room amenity" next to
     "Room amenities". */
  const tags = [...new Set(allRows.map((r) => r.tag).filter(Boolean))];
  const nextPosition = (allRows.at(-1)?.position ?? -1) + 1;

  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (err === "touch") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — that little-touch symbol isn't one the site knows how to draw. Pick one of the six.";
  } else if (err === "perm") {
    noticeTone = "err";
    noticeMessage =
      "Nothing was deleted — deleting is the developer's, and an owner needs access granted for it. Everything else on this page is yours to edit.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Added — it is on the amenities page.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Removed — it is off the amenities page.";
  }

  async function saveItem(formData: FormData) {
    "use server";
    await requireSession();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const slug = get("slug");
    if (!slug) return;

    /* The two tag inputs — the radio group and the free-text override. The
       free-text wins when it is filled in, so the picker is a convenience, not
       a limit. Both are strings and need no per-row name suffix because each
       form is its own scope. */
    const tag = get("tag_other") || get("tag");

    /* featured and touch arrive as a checkbox and a radio; composeAmenityExtra
       re-checks the touch name against the six the public page can draw, so a
       hand-crafted POST cannot write a symbol that renders as nothing. */
    const built = composeAmenityExtra(
      Boolean(formData.get("featured")),
      get("touch"),
    );
    if ("error" in built) amenityRedirect(query, "err", built.error);
    const extra = JSON.stringify(built.extra);

    /* Resolved before the write, not from a RETURNING clause: auditedWrite
       batches the write and its audit row into one D1 transaction, and a batch
       cannot feed one statement's output into another's bindings. It is also
       what tells an edit apart from a create. */
    const existing = await env.DB.prepare(
      "SELECT * FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(SECTION, slug)
      .first();

    const after = {
      position: Number(get("position")) || 0,
      title: get("title"),
      tag,
      body: get("body"),
      image: get("image"),
      extra,
      published: formData.get("published") ? 1 : 0,
      paid: get("paid") === "1" ? 1 : 0,
    };

    /* Insert-or-update in one statement. href/video/icon are written empty
       because no amenity has ever had one — the public page looks its symbol
       up from the category, not from a per-row icon column. `image` is carried
       from the row's hidden field so a save does not blank the one seeded
       photo. */
    const write = env.DB.prepare(
      `INSERT INTO content (section, slug, position, title, tag, body, href, image, video, icon, extra, published, paid, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, '', '', ?8, ?9, ?10, datetime('now'))
       ON CONFLICT (section, slug) DO UPDATE SET
         position = ?3, title = ?4, tag = ?5, body = ?6, image = ?7,
         extra = ?8, published = ?9, paid = ?10, updated_at = datetime('now')`,
    ).bind(
      SECTION,
      slug,
      after.position,
      after.title,
      after.tag,
      after.body,
      after.image,
      extra,
      after.published,
      after.paid,
    );

    await auditedWrite(write, {
      actor: await getActor(),
      action: existing ? "content.update" : "content.create",
      section: SECTION,
      slug,
      before: existing ?? null,
      after,
    });

    amenityRedirect(query, "ok", existing ? "saved" : "added");
  }

  async function removeItem(formData: FormData) {
    "use server";
    if (!(await can(await requireSession(), "content.delete")).allowed) {
      amenityRedirect(query, "err", "perm");
    }
    const slug = String(formData.get("slug") ?? "");
    if (!slug) return;

    const row = await env.DB.prepare("SELECT * FROM content WHERE section = ?1 AND slug = ?2")
      .bind(SECTION, slug)
      .first();
    if (!row) return;

    const write = env.DB.prepare("DELETE FROM content WHERE section = ?1 AND slug = ?2").bind(
      SECTION,
      slug,
    );
    await auditedWrite(write, {
      actor: await getActor(),
      action: "content.delete",
      section: SECTION,
      slug,
      before: row,
      after: null,
    });

    amenityRedirect(query, "ok", "deleted");
  }

  /* The category picker, identical in the edit row and the add-new form.
     Radios are scoped by their own form, so the plain name "tag" is correct
     everywhere. The free-text override sits below the picker because a staff
     member is more likely to tick a known category than to type a new one, and
     the empty string wins when it is left blank. */
  const categoryPicker = (row?: (typeof rows)[number]) => (
    <div className="adm-con-field adm-con-wide">
      <p className="adm-con-legend adm-con-pick-head">Category</p>
      <div className="adm-con-pick">
        {CATEGORIES.map((c) => (
          <label key={c} className="adm-con-pick-btn">
            <input type="radio" name="tag" value={c} defaultChecked={row?.tag === c} />
            <span className="adm-con-pick-mark"><AmenityGlyph category={c} size={20} /></span>
            <span className="adm-con-pick-name">{c}</span>
          </label>
        ))}
      </div>
      <div className="adm-con-field">
        <label>Something else</label>
        <input name="tag_other" defaultValue={row && !CATEGORIES.includes(row.tag) ? row.tag : ""} />
        <small>Typing a category that is not in the list above shows a plain dot on the site until a symbol is drawn for it. What you type here wins over whatever is ticked.</small>
      </div>
    </div>
  );

  /* The paid radios, identical in the edit row and the add-new form. The site
     prints a small "Paid" mark on an amenity that costs extra, and this is the
     switch that drives that mark. */
  const paidPicker = (row?: (typeof rows)[number]) => (
    <div className="adm-con-field adm-con-wide">
      <p className="adm-con-legend">Cost to the guest</p>
      <div className="adm-con-choice">
        <label className="adm-con-choice-btn">
          <input type="radio" name="paid" value="0" defaultChecked={row ? row.paid === 0 : true} />
          <span>Included</span>
        </label>
        <label className="adm-con-choice-btn">
          <input type="radio" name="paid" value="1" defaultChecked={row?.paid === 1} />
          <span>Extra charge</span>
        </label>
      </div>
      <small>The site prints a small “Paid” mark on an amenity that costs extra.</small>
    </div>
  );

  /* The two feature strips, identical in the edit row and the add-new form.
     The highlights grid sits under “Our amenities” near the top of the page
     and follows the same Order number as the list below it. The little touch
     row is what prints beside the “Thoughtful touches” heading; six or so is
     what fits without wrapping. */
  const featurePanel = (row?: (typeof rows)[number]) => (
    <fieldset className="adm-con-panel adm-con-wide">
      <legend>Show it off on the page</legend>
      <label className="adm-con-tick">
        <input name="featured" type="checkbox" defaultChecked={row?.extra.featured === 1} />
        <span>Put it in the twelve-item highlights grid</span>
      </label>
      <p className="adm-con-legend">Little touch symbol</p>
      <div className="adm-con-pick">
        <label className="adm-con-pick-btn">
          <input type="radio" name="touch" value="" defaultChecked={!row?.extra.touch} />
          <span className="adm-con-pick-mark"></span>
          <span className="adm-con-pick-name">Not one</span>
        </label>
        {TOUCH_NAMES.map((n) => (
          <label key={n} className="adm-con-pick-btn">
            <input type="radio" name="touch" value={n} defaultChecked={row?.extra.touch === n} />
            <span className="adm-con-pick-mark"><TouchGlyph name={n} /></span>
            <span className="adm-con-pick-name">{n.charAt(0).toUpperCase() + n.slice(1)}</span>
          </label>
        ))}
      </div>
      <small>This is the “Thoughtful touches” row. Six or so is what fits, and the symbol is what draws beside it.</small>
    </fieldset>
  );

  return (
    <div className="adm-page adm-con">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Amenities</h1>
      <div className="adm-sub">
        Everything the property offers, grouped the way it prints on the page. Ticking one into
        the highlights or the touches row is what the front of the page shows off.
      </div>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

      <div className="adm-toolbar">
        {/* Plain GET, no JS: it works with the back button and a bookmark,
            which a client-side filter would not. */}
        <form className="adm-search" action="/admin/amenities">
          <input type="search" name="q" placeholder="Search an amenity or a category…" defaultValue={query} />
          <button type="submit">Search</button>
        </form>
      </div>

      <p className="adm-count">
        {rows.length} {rows.length === 1 ? "item" : "items"}
        {query && <> matching “{query}”</>} in {groups.length}{" "}
        {groups.length === 1 ? "category" : "categories"}
      </p>

      {groups.map((group) => (
        <section className="adm-group" key={group.tag}>
          <h2 className="adm-group-head">
            {group.tag || "No category"}
            <span className="adm-group-count">{group.items.length}</span>
          </h2>

          {group.items.map((row) => {
            const metaBits: string[] = [];
            if (row.paid === 1) metaBits.push("Extra charge");
            if (row.extra.featured === 1) metaBits.push("In the highlights");
            if (row.extra.touch) metaBits.push("Little touch");
            const metaText = metaBits.length > 0 ? metaBits.join(" · ") : (row.tag || "No category");

            return (
              /* Collapsed by default: the summary carries the name and the
                 flags that matter, which is what somebody scanning for the
                 thing they came to change is reading. The form is a click
                 away, not many forms unrolled. */
              <details key={row.slug} className="adm-row">
                <summary className="adm-summary">
                  <span className="adm-thumb adm-thumb--glyph"><AmenityGlyph category={row.tag} size={20} /></span>
                  <span className="adm-summary-main">
                    <span className="adm-summary-title">{row.title || row.slug}</span>
                    <span className="adm-summary-meta">{metaText}</span>
                  </span>
                  <span className={`badge ${row.published ? "badge--on" : "badge--off"}`}>
                    {row.published ? "shown" : "hidden"}
                  </span>
                </summary>

                <form className="adm-item" action={saveItem}>
                  <input type="hidden" name="section" value={SECTION} />

                  <div className="adm-con-grid">
                    <div className="adm-con-field">
                      <label>Short name</label>
                      {/* Read-only: (section, slug) is the primary key, so editing
                          it here would create a duplicate rather than rename. */}
                      <input name="slug" defaultValue={row.slug} required readOnly />
                    </div>

                    <div className="adm-con-field">
                      <label>Order</label>
                      <input name="position" type="number" defaultValue={row.position} />
                      <small>Lowest first, within its category.</small>
                    </div>

                    <label className="adm-con-tick">
                      <input name="published" type="checkbox" defaultChecked={row.published === 1} />
                      <span>Show on the amenities page</span>
                    </label>

                    <div className="adm-con-field adm-con-wide">
                      <label>Name</label>
                      <input name="title" defaultValue={row.title} />
                    </div>

                    {categoryPicker(row)}

                    <div className="adm-con-field adm-con-wide">
                      <label>Description</label>
                      <textarea name="body" rows={3} defaultValue={row.body} />
                      <small>Optional. Most amenities have a short line or none.</small>
                    </div>

                    {paidPicker(row)}
                    {featurePanel(row)}

                    {/* Carried forward from the row that was seeded before the
                        image field was removed from this form. A save must not
                        blank it. */}
                    <input type="hidden" name="image" defaultValue={row.image} />
                  </div>

                  <div className="adm-item-bar">
                    <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Saving…">
                      Save
                    </SubmitButton>
                  </div>
                </form>

                {/* Its own form, sibling to the save form — a <form> inside a
                    <form> is invalid HTML and browsers drop the inner one. The
                    disclosure is the confirm: no JavaScript, and it cannot be
                    armed on the way past to Save. */}
                {canDelete ? (
                  <details className="adm-item-danger">
                    <summary>Remove from the amenities…</summary>
                    <form action={removeItem}>
                      <input type="hidden" name="section" value={SECTION} />
                      <input type="hidden" name="slug" value={row.slug} />
                      <p>
                        Remove <b>{row.title || row.slug}</b>? It goes from the amenities page
                        immediately, and there is no undo. To take it off for the season instead,
                        untick <b>Show on the amenities page</b> and save.
                      </p>
                      <SubmitButton
                        type="submit"
                        className="adm-btn adm-btn--bad"
                        pendingText="Removing…"
                      >
                        Yes, remove it
                      </SubmitButton>
                    </form>
                  </details>
                ) : (
                  <p className="adm-item-locked">
                    Removing is the developer&rsquo;s. An owner can be given it for 24 hours — ask
                    them. Everything else here is yours to change.
                  </p>
                )}
              </details>
            );
          })}
        </section>
      ))}

      <datalist id="adm-amenity-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* Numbered, in the order the questions actually occur, rather than a
          blank copy of the edit row where nothing marks the boxes that must be
          filled in. */}
      <fieldset className="adm-con-panel adm-new">
        <legend>Add an amenity</legend>
        <form className="adm-item" action={saveItem}>
          <input type="hidden" name="section" value={SECTION} />
          <input type="hidden" name="published" value="on" />
          <ol className="adm-steps">
            <li>
              <b>Name it</b>
              <div className="adm-con-grid">
                <div className="adm-con-field adm-con-wide">
                  <label>Name</label>
                  <input name="title" placeholder="Laundry service" />
                </div>
                <div className="adm-con-field">
                  <label>Short name</label>
                  <input name="slug" required placeholder="laundry-service" />
                  <small>Lowercase, no spaces. It cannot be changed later.</small>
                </div>
              </div>
            </li>

            <li>
              <b>Put it in a category</b>
              <div className="adm-con-grid">
                {categoryPicker()}
                <div className="adm-con-field">
                  <label>Order</label>
                  <input name="position" type="number" defaultValue={nextPosition} />
                  <small>Lowest first.</small>
                </div>
                <div className="adm-con-field adm-con-wide">
                  <label>Description</label>
                  <textarea name="body" rows={2} />
                  <small>Optional.</small>
                </div>
              </div>
            </li>

            <li>
              <b>Say what it costs</b>
              <div className="adm-con-grid">
                {paidPicker()}
              </div>
            </li>

            <li>
              <b>Show it off</b>
              <div className="adm-con-grid">
                {featurePanel()}
              </div>
            </li>
          </ol>

          <div className="adm-item-bar">
            <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Adding…">
              Add it to the amenities
            </SubmitButton>
          </div>
        </form>
      </fieldset>
    </div>
  );
}
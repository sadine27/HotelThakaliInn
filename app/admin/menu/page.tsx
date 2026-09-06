import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { auditedWrite } from "@/lib/audit";
import AdminNotice from "@/components/AdminNotice";
import PhotoPicker from "@/components/PhotoPicker";
import PriceRows from "@/components/PriceRows";
import SubmitButton from "@/components/SubmitButton";
import { section } from "@/lib/content";
import { bankItems } from "@/lib/media-store";
import { SIZE_NAMES, composeMenuExtra, sizeRows, type MenuExtra } from "@/lib/menu";

export const dynamic = "force-dynamic";

/* The restaurant menu, on its own screen.
 *
 * It used to be four tabs on /admin/content, editing the same generic row that
 * a hero slide and a room use — a Price box bolted onto a form built for
 * something else. Two things made that untenable rather than merely untidy:
 *
 *   - A drink is now one row holding its pours (migration 0022), and the
 *     generic editor rebuilds `extra` from the one Price box it draws. Saving a
 *     drink there would have thrown its sizes away without saying so.
 *   - A menu is read by category. 89 rows in one flat list ordered by a number
 *     is not how anybody looks for the price of a momo.
 *
 * So the menu sections are gone from that screen and live here, grouped under
 * the printed menu's own headings. Deleting is the same capability and the same
 * re-check inside the action — a form that isn't drawn is not a permission. */

const SECTIONS = ["menu_breakfast", "menu_snacks", "menu_mains", "menu_bar"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (value: string): value is Section => SECTIONS.includes(value as Section);

const TAB_LABEL: Record<Section, string> = {
  menu_breakfast: "Breakfast",
  menu_snacks: "Snacks & Starters",
  menu_mains: "Mains",
  menu_bar: "Bar & Drinks",
};

const TITLES: Record<Section, string> = {
  menu_breakfast: "The breakfast list on the Cuisine page.",
  menu_snacks: "Kebabs, burgers, sandwiches, salads, soups, starters and noodles.",
  menu_mains: "Curries, sekuwa, rice, bread, momo, platters, biryani and dessert.",
  menu_bar: "Tea, juices, spirits, beer, wine, shisha and cigarettes.",
};

/* Module-level for the same reason contentRedirect is: a "use server" action is
   hoisted out of the component, and a captured function value cannot be
   serialized to follow it. Plain strings can, so the tab and the search term
   are fine to close over. */
function menuRedirect(
  name: Section,
  query: string,
  kind: "ok" | "err",
  code: string,
): never {
  const p = new URLSearchParams();
  p.set("s", name);
  if (query) p.set("q", query);
  p.set(kind, code);
  redirect(`/admin/menu?${p.toString()}`);
}

export default async function Menu({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; q?: string; ok?: string; err?: string }>;
}) {
  const session = await requireSession();
  /* Read once for the render; the action re-asks at the moment of the write,
     because a grant can expire while this page is open. */
  const canDelete = (await can(session, "content.delete")).allowed;
  const { s, q, ok, err } = await searchParams;
  const name: Section = s && isSection(s) ? s : "menu_breakfast";
  const query = (q ?? "").trim();

  /* true = include unpublished, or taking an item off the menu for the season
     would also take it out of this editor and there would be no way to put it
     back. */
  const allRows = await section<MenuExtra>(name, true);
  const bank = await bankItems();

  const needle = query.toLowerCase();
  const rows = needle
    ? allRows.filter((r) => [r.title, r.slug, r.tag].some((v) => v.toLowerCase().includes(needle)))
    : allRows;

  /* Grouped in the order the rows already sit in, which is the order the
     printed menu prints them — not alphabetically, and not by a Map's
     insertion-order accident: `position` is what the public page sorts by, so
     the two lists read the same way. */
  const groups: { tag: string; items: typeof rows }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.tag === row.tag) last.items.push(row);
    else groups.push({ tag: row.tag, items: [row] });
  }

  /* Offered on the "Add a new one" form so a new dish joins a heading that
     already exists rather than inventing "Deserts" next to "Dessert". */
  const tags = [...new Set(allRows.map((r) => r.tag).filter(Boolean))];
  const nextPosition = (allRows.at(-1)?.position ?? -1) + 1;

  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (err === "price") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — every line needs a price, and at least one line has to be filled in.";
  } else if (err === "label") {
    noticeTone = "err";
    noticeMessage =
      "Nothing was saved — once there is more than one price, each one needs a size name (30ml, Bottle 650ml). Only a single price can be left unnamed.";
  } else if (err === "duplicate") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — two lines have the same size name.";
  } else if (err === "perm") {
    noticeTone = "err";
    noticeMessage =
      "Nothing was deleted — deleting is the developer's, and an owner needs access granted for it. Everything else on this page is yours to edit.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved.";
  } else if (ok === "added") {
    noticeTone = "ok";
    noticeMessage = "Added — it is on the menu.";
  } else if (ok === "deleted") {
    noticeTone = "ok";
    noticeMessage = "Removed — it is off the menu.";
  }

  async function saveItem(formData: FormData) {
    "use server";
    await requireSession();

    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const sec = get("section");
    const slug = get("slug");
    if (!isSection(sec) || !slug) return;

    /* getAll, not get: the price editor posts one size_label/size_price pair
       per line, and the two arrays line up by index. Both are re-checked here
       rather than trusted from the browser — a hand-crafted POST reaches this
       action with whatever it likes in them. */
    const built = composeMenuExtra(
      formData.getAll("size_label").map(String),
      formData.getAll("size_price").map(String),
    );
    if ("error" in built) menuRedirect(name, query, "err", built.error);
    const extra = JSON.stringify(built.extra);

    /* Resolved before the write, not from a RETURNING clause: auditedWrite
       batches the write and its audit row into one D1 transaction, and a batch
       cannot feed one statement's output into another's bindings. It is also
       what tells an edit apart from a create. */
    const existing = await env.DB.prepare(
      "SELECT * FROM content WHERE section = ?1 AND slug = ?2",
    )
      .bind(sec, slug)
      .first();

    const after = {
      position: Number(get("position")) || 0,
      title: get("title"),
      tag: get("tag"),
      body: get("body"),
      image: get("image"),
      extra,
      published: formData.get("published") ? 1 : 0,
    };

    /* Insert-or-update in one statement, so the blank form at the bottom and
       every row above it are the same action. href/video/icon are written empty
       because no menu item has ever had one — unlike `paid`, which the amenity
       tab owns and which a flat 0 here would quietly stamp over. */
    const write = env.DB.prepare(
      `INSERT INTO content (section, slug, position, title, tag, body, href, image, video, icon, extra, published, paid, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, '', '', ?8, ?9, 0, datetime('now'))
       ON CONFLICT (section, slug) DO UPDATE SET
         position = ?3, title = ?4, tag = ?5, body = ?6, image = ?7,
         extra = ?8, published = ?9, updated_at = datetime('now')`,
    ).bind(
      sec,
      slug,
      after.position,
      after.title,
      after.tag,
      after.body,
      after.image,
      extra,
      after.published,
    );

    await auditedWrite(write, {
      actor: await getActor(),
      action: existing ? "content.update" : "content.create",
      section: sec,
      slug,
      before: existing ?? null,
      after,
    });

    menuRedirect(name, query, "ok", existing ? "saved" : "added");
  }

  async function removeItem(formData: FormData) {
    "use server";
    if (!(await can(await requireSession(), "content.delete")).allowed) {
      menuRedirect(name, query, "err", "perm");
    }
    const sec = String(formData.get("section") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!isSection(sec) || !slug) return;

    const row = await env.DB.prepare("SELECT * FROM content WHERE section = ?1 AND slug = ?2")
      .bind(sec, slug)
      .first();
    if (!row) return;

    const write = env.DB.prepare("DELETE FROM content WHERE section = ?1 AND slug = ?2").bind(
      sec,
      slug,
    );
    await auditedWrite(write, {
      actor: await getActor(),
      action: "content.delete",
      section: sec,
      slug,
      before: row,
      after: null,
    });

    menuRedirect(name, query, "ok", "deleted");
  }

  /* The photo is the same picker every other admin screen uses, over the same
     bank. The public menu does not show it yet — it is collected because the
     kitchen has the pictures and nowhere to keep them, and a photo attached to
     the dish it is of is worth more later than a folder of filenames. */
  const photo = (row?: (typeof rows)[number]) => (
    <PhotoPicker
      name="image"
      label="Photo"
      kind="photo"
      items={bank}
      defaultValue={row?.image ?? ""}
      hint="Optional. The Cuisine page does not show it yet — it is kept with the dish for when it does."
    />
  );

  return (
    <div className="adm-page adm-con">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Menu</h1>
      <div className="adm-sub">{TITLES[name]}</div>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

      {/* Rendered once for the whole page. Every price editor points its
          `list` at this one id — one per row would be ninety copies of it. */}
      <datalist id="adm-size-names">
        {SIZE_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <nav className="adm-tabs">
        {SECTIONS.map((x) => (
          <Link key={x} href={`/admin/menu?s=${x}`} aria-current={x === name ? "page" : undefined}>
            {TAB_LABEL[x]}
          </Link>
        ))}
      </nav>

      <div className="adm-toolbar">
        {/* Plain GET, no JS: it works with the back button and a bookmark,
            which a client-side filter would not. */}
        <form className="adm-search" action="/admin/menu">
          <input type="hidden" name="s" value={name} />
          <input type="search" name="q" placeholder="Search a dish, drink or heading…" defaultValue={query} />
          <button type="submit">Search</button>
        </form>
      </div>

      <p className="adm-count">
        {rows.length} {rows.length === 1 ? "item" : "items"}
        {query && <> matching “{query}”</>} in {groups.length}{" "}
        {groups.length === 1 ? "heading" : "headings"}
      </p>

      {groups.map((group) => (
        <section className="adm-group" key={group.tag}>
          <h2 className="adm-group-head">
            {group.tag || "No heading"}
            <span className="adm-group-count">{group.items.length}</span>
          </h2>

          {group.items.map((row) => (
            /* Collapsed by default: the summary carries the name and the price,
               which is what somebody scanning for the thing they came to change
               is reading. The form is a click away, not ninety forms unrolled. */
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
                    {row.extra.sizes?.length
                      ? row.extra.sizes.map((z) => `${z.label} ${z.price}`).join(" · ")
                      : `Rs. ${row.extra.price ?? 0}`}
                  </span>
                </span>
                <span className={`badge ${row.published ? "badge--on" : "badge--off"}`}>
                  {row.published ? "shown" : "hidden"}
                </span>
              </summary>

              <form className="adm-item" action={saveItem}>
                <input type="hidden" name="section" value={name} />

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
                    <small>Lowest first, within its heading.</small>
                  </div>

                  <label className="adm-con-tick">
                    <input name="published" type="checkbox" defaultChecked={row.published === 1} />
                    <span>Show on the menu</span>
                  </label>

                  <div className="adm-con-field adm-con-wide">
                    <label>Name</label>
                    <input name="title" defaultValue={row.title} />
                  </div>

                  <div className="adm-con-field adm-con-wide">
                    <label>Heading</label>
                    <input name="tag" list="adm-menu-tags" defaultValue={row.tag} />
                    <small>The category it is printed under. Change it and the item moves.</small>
                  </div>

                  <div className="adm-con-field adm-con-wide">
                    <label>Description</label>
                    <textarea name="body" rows={3} defaultValue={row.body} />
                    <small>Optional. Most items have none.</small>
                  </div>

                  <PriceRows defaultValue={sizeRows(row.extra)} sizes={name === "menu_bar"} />
                  {photo(row)}
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
                  <summary>Remove from the menu…</summary>
                  <form action={removeItem}>
                    <input type="hidden" name="section" value={name} />
                    <input type="hidden" name="slug" value={row.slug} />
                    <p>
                      Remove <b>{row.title || row.slug}</b>? It goes from the Cuisine page
                      immediately, and there is no undo. To take it off for the season instead,
                      untick <b>Show on the menu</b> and save.
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
          ))}
        </section>
      ))}

      <datalist id="adm-menu-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* Numbered, in the order the questions actually occur, rather than a
          blank copy of the edit row where nothing marks the boxes that must be
          filled in. */}
      <fieldset className="adm-con-panel adm-new">
        <legend>Add something to the menu</legend>
        <form className="adm-item" action={saveItem}>
          <input type="hidden" name="section" value={name} />
          <input type="hidden" name="published" value="on" />
          <ol className="adm-steps">
            <li>
              <b>Name it</b>
              <div className="adm-con-grid">
                <div className="adm-con-field adm-con-wide">
                  <label>Name</label>
                  <input name="title" placeholder="Chicken Momo (Steam)" />
                </div>
                <div className="adm-con-field">
                  <label>Short name</label>
                  <input name="slug" required placeholder="chicken-momo-steam" />
                  <small>Lowercase, no spaces. It cannot be changed later.</small>
                </div>
              </div>
            </li>

            <li>
              <b>Put it under a heading</b>
              <div className="adm-con-grid">
                <div className="adm-con-field adm-con-wide">
                  <label>Heading</label>
                  <input name="tag" list="adm-menu-tags" required placeholder="Special Momo" />
                  <small>Pick one that is already there, or type a new one.</small>
                </div>
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
                <PriceRows defaultValue={[{ label: "", price: 0 }]} sizes={name === "menu_bar"} />
              </div>
            </li>

            <li>
              <b>Give it a picture</b>
              <div className="adm-con-grid">{photo()}</div>
            </li>
          </ol>

          <div className="adm-item-bar">
            <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Adding…">
              Add it to the menu
            </SubmitButton>
          </div>
        </form>
      </fieldset>
    </div>
  );
}

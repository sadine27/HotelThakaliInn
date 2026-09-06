"use client";

import { useMemo, useState } from "react";
import MediaUpload from "@/components/MediaUpload";
import SubmitButton from "@/components/SubmitButton";
import { BANK_FREE_BYTES, BANK_WARN_BYTES, formatBytes } from "@/lib/media";
import type { BankItem } from "@/lib/media-store";

/* The contact sheet and the one photo you are looking at.
 *
 * Selection is client state rather than a ?photo= in the URL on purpose: this
 * is a screen for scanning, and forty round trips to look at forty photos is
 * the thing that makes the current admin feel like a filing cabinet. The forms
 * inside the panel are still ordinary Server Actions, so nothing about saving
 * or deleting depends on JavaScript.
 *
 * The list is handed in whole and filtered here for the same reason — a search
 * box that reloads the page is a search box nobody uses twice. */

const SECTION_NAME: Record<string, string> = {
  hero: "Home — big slides",
  service: "Home — small cards",
  room: "Rooms",
  gallery: "Gallery",
  amenity: "Amenities",
  menu_breakfast: "Breakfast menu",
  menu_snacks: "Snacks menu",
  menu_mains: "Mains menu",
  menu_bar: "Bar menu",
  /* Nothing renders section("breakfast") any more — /breakfast redirects to
     /cuisine — but rows still point at photos, so the filter has to say what
     they are rather than offer a page that does not exist. */
  breakfast: "Old breakfast list (not shown)",
};

const sectionName = (s: string) => SECTION_NAME[s] ?? s;

/* The one sentence that answers "is this doing anything?" — item 5. It is
   derived from the content table on every render rather than typed by anyone,
   because a description someone has to remember to update is a description that
   goes stale the first time a card changes photo. */
function whereUsed(item: BankItem): string {
  if (item.usedBy.length === 0) return "Currently not used anywhere on the site";
  const list = item.usedBy.map((u) => `${sectionName(u.section)} · ${u.slug}`);
  return `In use on ${list.join(", ")}`;
}

type Props = {
  items: BankItem[];
  canDelete: boolean;
  leftToday: number;
  bytes: number;
  saveDetails: (formData: FormData) => Promise<void>;
  removeItem: (formData: FormData) => Promise<void>;
};

export default function BankBoard({
  items,
  canDelete,
  leftToday,
  bytes,
  saveDetails,
  removeItem,
}: Props) {
  const [kind, setKind] = useState<"photo" | "video">("photo");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  const photos = items.filter((i) => i.kind === "photo");
  const videos = items.filter((i) => i.kind === "video");
  const ofKind = kind === "video" ? videos : photos;

  /* Only the sections that actually hold something, so the filter never offers
     a page that would come back empty. */
  const pages = useMemo(() => {
    const seen = new Set<string>();
    for (const i of items) for (const u of i.usedBy) seen.add(u.section);
    return [...seen].sort((a, b) => sectionName(a).localeCompare(sectionName(b)));
  }, [items]);

  const needle = query.trim().toLowerCase();
  const shown = ofKind.filter((i) => {
    if (page === "none" ? i.usedBy.length > 0 : page && !i.usedBy.some((u) => u.section === page)) {
      return false;
    }
    if (!needle) return true;
    return (
      i.name.toLowerCase().includes(needle) ||
      i.caption.toLowerCase().includes(needle) ||
      i.usedBy.some((u) => sectionName(u.section).toLowerCase().includes(needle))
    );
  });

  /* Falls back to the first thing on screen so the panel is never blank, and
     follows the tabs when the selected photo is not in the tab you switched to. */
  const one = ofKind.find((i) => i.path === selected) ?? shown[0] ?? ofKind[0];
  const pct = Math.min(100, (bytes / BANK_FREE_BYTES) * 100);
  const unusedCount = items.filter((i) => !i.repo && i.usedBy.length === 0).length;

  return (
    <div className="adm-bank">
      <div className="adm-bank-sheet">
        <div className="adm-bank-kinds" role="tablist" aria-label="Photos or videos">
          {(["photo", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              className="adm-bank-kind"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setConfirming(false);
              }}
            >
              {k === "photo" ? "Photos" : "Videos"}
              <b>{k === "photo" ? photos.length : videos.length}</b>
            </button>
          ))}
        </div>

        <div className="adm-bank-tools">
          <input
            type="search"
            className="adm-bank-search"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the bank"
          />
          <select
            className="adm-bank-filter"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            aria-label="Filter by where it is used"
          >
            <option value="">Used anywhere</option>
            <option value="none">Not used yet</option>
            {pages.map((s) => (
              <option key={s} value={s}>
                {sectionName(s)}
              </option>
            ))}
          </select>
          <span className="adm-bank-count">
            {shown.length === ofKind.length ? `${ofKind.length}` : `${shown.length} of ${ofKind.length}`}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="adm-bank-empty">
            {ofKind.length === 0
              ? kind === "video"
                ? "No videos yet. The gallery clips that ship with the site appear here once they are in use."
                : "Nothing in the bank yet. Add a photo and it will appear here, ready to use anywhere on the site."
              : "Nothing matches that."}
          </p>
        ) : (
          <ul className="adm-bank-grid">
            {shown.map((i) => (
              <li key={i.path}>
                <button
                  type="button"
                  className="adm-bank-cell"
                  aria-pressed={i.path === one?.path}
                  title={`${i.name} — ${whereUsed(i)}`}
                  onClick={() => {
                    setSelected(i.path);
                    setConfirming(false);
                  }}
                >
                  {i.kind === "video" && !i.poster ? (
                    /* No poster was ever extracted for the clips that ship with
                       the site, and an <img> pointed at an .mp4 draws the
                       browser's broken-file icon. A muted <video> seeked half a
                       second in shows an opening frame instead — the same
                       picture, with no upload and no extra object in R2. Half a
                       second rather than zero because several of these clips
                       fade up from black, and frame zero is a black square. */
                    <video src={`${i.path}#t=0.5`} muted playsInline preload="metadata" />
                  ) : (
                    <img src={i.kind === "video" ? i.poster : i.thumb} alt={i.name} loading="lazy" />
                  )}
                  {i.kind === "video" && <span className="adm-bank-play" aria-hidden="true" />}
                  {i.usedBy.length === 0 && <span className="adm-bank-flag">unused</span>}
                  {i.repo && <span className="adm-bank-flag adm-bank-flag--repo">built in</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="adm-bank-side">
        <fieldset className="adm-con-panel">
          <legend>Storage</legend>
          <div
            className="adm-bank-gauge"
            data-state={bytes >= BANK_WARN_BYTES ? "bad" : pct >= 40 ? "warn" : "ok"}
          >
            <div className="adm-bank-gauge-fill" style={{ width: `${Math.max(pct, 0.6)}%` }} />
          </div>
          <p className="adm-bank-gauge-note">
            <b>{formatBytes(bytes)}</b> of {formatBytes(BANK_FREE_BYTES)} used
            {unusedCount > 0 && ` · ${unusedCount} not used anywhere`}
          </p>
          <MediaUpload leftToday={leftToday} />
        </fieldset>

        {one && (
          <fieldset className="adm-con-panel">
            <legend>{one.repo ? "Built into the site" : one.kind === "video" ? "This video" : "This photo"}</legend>

            {one.kind === "video" ? (
              <div className="adm-bank-big">
                {/* controls, and no autoplay: this panel is opened while
                    scanning, and a clip that starts talking on its own is the
                    behaviour everyone hates on a hotel website. */}
                <video src={one.path} poster={one.poster || undefined} controls preload="metadata" />
                <small>Click the video to play it.</small>
              </div>
            ) : (
              <a className="adm-bank-big" href={one.path} target="_blank" rel="noreferrer">
                <img src={one.path} alt={one.name} />
                <small>Open the full size in a new tab</small>
              </a>
            )}

            <p className="adm-bank-where" data-state={one.usedBy.length ? "used" : "free"}>
              {whereUsed(one)}
            </p>

            <dl className="adm-bank-facts">
              <dt>Name</dt>
              <dd>{one.name}</dd>
              {one.width > 0 && (
                <>
                  <dt>Size</dt>
                  <dd>
                    {one.width} × {one.height} · {formatBytes(one.bytes)}
                  </dd>
                </>
              )}
              {one.uploadedBy && (
                <>
                  <dt>Added by</dt>
                  <dd>
                    {one.uploadedBy} · {one.uploadedAt.slice(0, 10)}
                  </dd>
                </>
              )}
            </dl>

            {one.repo ? (
              <p className="adm-bank-note">
                This one ships inside the site itself rather than being uploaded, so it cannot be
                renamed or deleted from here — deleting it would mean changing the site’s own code.
                It can still be chosen for any card.
              </p>
            ) : (
              <>
                {/* Keyed on the path so switching photos rebuilds the form with
                    the new values instead of keeping the last one's text. */}
                <form action={saveDetails} key={one.path} className="adm-bank-form">
                  <input type="hidden" name="key" value={one.key} />

                  <label>
                    Name
                    <input
                      name="name"
                      defaultValue={one.name}
                      required
                      maxLength={120}
                      placeholder="Deluxe king room, morning light"
                    />
                    <small>What everyone searches by. Say what is in the picture, in plain words.</small>
                  </label>

                  <label>
                    Where the original lives
                    <input
                      name="originUrl"
                      type="url"
                      defaultValue={one.originUrl}
                      maxLength={500}
                      placeholder="https://drive.google.com/…"
                    />
                    <small>
                      Optional. The site stores a web-sized copy only — paste the link to the
                      full-quality file so it can be found when it is needed.
                    </small>
                  </label>

                  <SubmitButton className="adm-btn" pendingText="Saving…">
                    Save
                  </SubmitButton>
                </form>

                <div className="adm-bank-danger">
                  {!canDelete ? (
                    <p className="adm-con-lock">
                      Deleting photos is a developer’s job. An owner can be given it for 24 hours —
                      ask, and it appears here.
                    </p>
                  ) : one.usedBy.length > 0 ? (
                    <p className="adm-bank-note">
                      Still in use on {one.usedBy.length} card
                      {one.usedBy.length === 1 ? "" : "s"}. Point those at a different photo first,
                      then it can be deleted.
                    </p>
                  ) : !confirming ? (
                    <button type="button" className="adm-btn adm-btn--x" onClick={() => setConfirming(true)}>
                      Delete this {one.kind === "video" ? "video" : "photo"}
                    </button>
                  ) : (
                    <form action={removeItem} className="adm-bank-confirm">
                      <input type="hidden" name="key" value={one.key} />
                      <p>Delete {one.name}? This cannot be undone.</p>
                      <SubmitButton className="adm-btn adm-btn--x" pendingText="Deleting…">
                        Yes, delete it
                      </SubmitButton>
                      <button type="button" className="adm-btn" onClick={() => setConfirming(false)}>
                        Keep it
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}

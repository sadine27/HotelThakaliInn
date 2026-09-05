"use client";

import { useState } from "react";
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
};

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
  const [selected, setSelected] = useState<string>(items[0]?.path ?? "");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          i.caption.toLowerCase().includes(needle) ||
          i.usedBy.some((u) => (SECTION_NAME[u.section] ?? u.section).toLowerCase().includes(needle)),
      )
    : items;

  const one = items.find((i) => i.path === selected);
  const pct = Math.min(100, (bytes / BANK_FREE_BYTES) * 100);
  const unusedCount = items.filter((i) => !i.repo && i.usedBy.length === 0).length;

  return (
    <div className="adm-bank">
      <div className="adm-bank-sheet">
        <div className="adm-bank-tools">
          <input
            type="search"
            className="adm-bank-search"
            placeholder="Search by name, caption or where it is used"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the photo bank"
          />
          <span className="adm-bank-count">
            {shown.length === items.length
              ? `${items.length} photo${items.length === 1 ? "" : "s"}`
              : `${shown.length} of ${items.length}`}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="adm-bank-empty">
            {items.length === 0
              ? "Nothing in the bank yet. Add a photo and it will appear here, ready to use anywhere on the site."
              : "No photo matches that."}
          </p>
        ) : (
          <ul className="adm-bank-grid">
            {shown.map((i) => (
              <li key={i.path}>
                <button
                  type="button"
                  className="adm-bank-cell"
                  aria-pressed={i.path === selected}
                  onClick={() => {
                    setSelected(i.path);
                    setConfirming(false);
                  }}
                >
                  <img src={i.thumb} alt={i.caption || i.name} loading="lazy" />
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
            <legend>{one.repo ? "Built into the site" : "This photo"}</legend>

            <a className="adm-bank-big" href={one.path} target="_blank" rel="noreferrer">
              <img src={one.path} alt={one.caption || one.name} />
              <small>Open the full size in a new tab</small>
            </a>

            <dl className="adm-bank-facts">
              <dt>File</dt>
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
              <dt>Used on</dt>
              <dd>
                {one.usedBy.length === 0 ? (
                  <em>Nowhere yet</em>
                ) : (
                  one.usedBy
                    .map((u) => `${SECTION_NAME[u.section] ?? u.section} — ${u.slug}`)
                    .join(", ")
                )}
              </dd>
            </dl>

            {one.repo ? (
              <p className="adm-bank-note">
                This photo ships with the site itself rather than being uploaded, so it cannot be
                changed or removed from here. It can still be chosen for any card.
              </p>
            ) : (
              <>
                {/* Keyed on the path so switching photos rebuilds the form with
                    the new values instead of keeping the last one's text. */}
                <form action={saveDetails} key={one.path} className="adm-bank-form">
                  <input type="hidden" name="key" value={one.key} />

                  <label>
                    What this photo shows
                    <input
                      name="caption"
                      defaultValue={one.caption}
                      maxLength={200}
                      placeholder="Deluxe king room, morning light"
                    />
                    <small>
                      Used to find it again later, and kept as a written record of what was
                      photographed.
                    </small>
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
                      Delete this photo
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

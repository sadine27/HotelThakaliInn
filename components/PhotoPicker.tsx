"use client";

import { useRef, useState } from "react";
import type { BankItem } from "@/lib/media-store";

/* Choose a photo, instead of typing where one lives.
 *
 * This replaces a free-text <input name="image"> whose help text read "a path
 * like /media/rooms/deluxe-king.jpg" — a control that can only be used by
 * somebody who already knows the answer, which is the exact failure the admin
 * is being rebuilt to stop.
 *
 * The value it writes is the same string that box held, so nothing downstream
 * changes: saveItem still reads formData.get("image"), and the column still
 * holds a path. The bank is handed in whole from the server; filtering forty
 * items in the browser is cheaper than a round trip per keystroke.
 *
 * A <dialog> rather than a hand-rolled overlay, for Escape, the backdrop and
 * focus containment — all three free, none of them worth writing again. */

type Props = {
  /* The column being written: image, video or icon. */
  name: string;
  label: string;
  kind: "photo" | "video";
  items: BankItem[];
  defaultValue: string;
  /* Shown under the control when nothing is chosen. */
  hint?: string;
};

export default function PhotoPicker({ name, label, kind, items, defaultValue, hint }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  /* The grid is built on first open, not on render. There is one of these per
     row, and the amenities tab has sixty-eight rows: filling every closed
     dialog with the whole bank meant about two thousand <img> tags in the
     document before anybody had clicked anything. */
  const [live, setLive] = useState(false);

  const pool = items.filter((i) => i.kind === kind);
  const chosen = pool.find((i) => i.path === value);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? pool.filter(
        (i) => i.name.toLowerCase().includes(needle) || i.path.toLowerCase().includes(needle),
      )
    : pool;

  function open() {
    setLive(true);
    ref.current?.showModal();
  }

  function pick(path: string) {
    setValue(path);
    ref.current?.close();
  }

  return (
    <div className="adm-con-field adm-pick">
      {/* A <span>, not a <label>: forty rows on this page each render one of
          these, so an id would be forty copies of "pick-image" and every
          htmlFor would point at the first row's button. The buttons name
          themselves instead. */}
      <span className="adm-con-legend">{label}</span>
      <input type="hidden" name={name} value={value} />

      <div className="adm-pick-row">
        {value ? (
          <span className="adm-pick-shot">
            {kind === "video" ? (
              /* Same trick the bank uses: an <img> pointed at an .mp4 draws the
                 browser's broken-file icon, and no poster exists for the clips
                 that ship with the site. */
              <video src={`${value}#t=0.5`} muted playsInline preload="metadata" />
            ) : (
              <img src={chosen?.thumb || value} alt="" />
            )}
          </span>
        ) : (
          <span className="adm-pick-shot adm-pick-shot--empty" aria-hidden="true" />
        )}

        <span className="adm-pick-side">
          <b className="adm-pick-name">
            {value ? (chosen?.name ?? value) : `No ${kind === "video" ? "video" : "photo"} chosen`}
          </b>
          <span className="adm-pick-acts">
            <button
              type="button"
              className="adm-btn adm-btn--sm"
              aria-label={`${value ? "Change" : "Choose"} the ${label.toLowerCase()}`}
              onClick={open}
            >
              {value ? "Change" : `Choose ${kind === "video" ? "a video" : "a photo"}`}
            </button>
            {value && (
              <button
                type="button"
                className="adm-btn adm-btn--sm"
                aria-label={`Remove the ${label.toLowerCase()}`}
                onClick={() => setValue("")}
              >
                Remove
              </button>
            )}
          </span>
        </span>
      </div>

      {!value && hint && <small>{hint}</small>}

      <dialog ref={ref} className="adm-pick-modal">
        <div className="adm-pick-head">
          <b>Choose {kind === "video" ? "a video" : "a photo"}</b>
          <input
            type="search"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the photo bank"
          />
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>

        {!live ? null : shown.length === 0 ? (
          <p className="adm-pick-none">
            {pool.length === 0
              ? `Nothing in the bank yet. Add one on the Photo bank screen, then it appears here.`
              : "Nothing matches that."}
          </p>
        ) : (
          <ul className="adm-pick-grid">
            {shown.map((i) => (
              <li key={i.path}>
                <button
                  type="button"
                  className="adm-bank-cell"
                  aria-pressed={i.path === value}
                  title={i.name}
                  onClick={() => pick(i.path)}
                >
                  {i.kind === "video" && !i.poster ? (
                    <video src={`${i.path}#t=0.5`} muted playsInline preload="metadata" />
                  ) : (
                    <img
                      src={i.kind === "video" ? i.poster : i.thumb}
                      alt={i.name}
                      loading="lazy"
                    />
                  )}
                  {i.kind === "video" && <span className="adm-bank-play" aria-hidden="true" />}
                  <span className="adm-pick-cap">{i.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </div>
  );
}

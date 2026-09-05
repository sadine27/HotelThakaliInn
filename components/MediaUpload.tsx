"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, CAPS, MAX_BYTES, RAW_REFUSAL, formatBytes } from "@/lib/media";

/* The upload control for the photo bank.
 *
 * The resizing happens here, in the browser, for two reasons that have both
 * already bitten this project: an upload over a few MB dies at the transport
 * with no message anyone can act on, and an uploaded photo bypasses
 * next/image's optimizer entirely (it cannot fetch R2), so whatever is sent is
 * byte-for-byte what every guest downloads. A 6.4 MB camera JPEG becomes about
 * 200 KB here before it is ever sent.
 *
 * Carried over from the per-row PhotoField this replaces:
 *   - `imageOrientation: "from-image"`, because phones record rotation in EXIF
 *     rather than in the pixels, and a canvas that ignores it stores every
 *     portrait photo on its side, permanently.
 *   - the server still sniffs magic bytes and still enforces the same limits;
 *     nothing here is a security check, it is a courtesy to the connection.
 *
 * Changed from it: WebP instead of JPEG (~30% smaller for the same look, and
 * unlike JPEG it keeps transparency, so no white is painted underneath), always
 * resized rather than only when over 900 KB, a 400px thumbnail made in the same
 * pass so the contact sheet does not download forty full photos to draw forty
 * squares, and several files at once. */

const MAX_EDGE = 1600;
const THUMB_EDGE = 400;
/* 0.82 rather than 0.8: WebP at 0.8 shows banding on the lobby's gradient wall,
   and the extra ~8 KB is invisible against a 200 KB file. */
const QUALITY = 0.82;

type Status = { name: string; state: "working" | "done" | "failed"; note: string };

async function render(bitmap: ImageBitmap, maxEdge: number): Promise<Blob | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
}

export default function MediaUpload({ leftToday }: { leftToday: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Status[]>([]);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(leftToday);

  function mark(name: string, state: Status["state"], note: string) {
    setRows((prev) => prev.map((r) => (r.name === name ? { ...r, state, note } : r)));
  }

  async function send(file: File): Promise<boolean> {
    /* Checked here as well as on the server so a 68 MB negative is refused
       instantly instead of after a minute of uploading. */
    if (/\.(arw|cr2|cr3|nef|dng|raf|orf|rw2|srw|pef)$/i.test(file.name)) {
      mark(file.name, "failed", RAW_REFUSAL);
      return false;
    }

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      mark(file.name, "failed", "This file could not be opened as a picture.");
      return false;
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const [full, thumb] = await Promise.all([
      render(bitmap, MAX_EDGE),
      render(bitmap, THUMB_EDGE),
    ]);
    bitmap.close();

    if (!full) {
      mark(file.name, "failed", "This picture could not be resized for the web.");
      return false;
    }
    if (full.size > MAX_BYTES.photo) {
      mark(file.name, "failed", `Still ${formatBytes(full.size)} after resizing — too large to store.`);
      return false;
    }

    const body = new FormData();
    body.set("file", full, "photo.webp");
    if (thumb) body.set("thumb", thumb, "thumb.webp");
    body.set("name", file.name);
    body.set("width", String(width));
    body.set("height", String(height));

    let data: { ok?: boolean; refusal?: string; left?: number };
    try {
      const res = await fetch("/admin/photos/upload", { method: "POST", body });
      data = await res.json();
    } catch {
      mark(file.name, "failed", "The upload did not reach the site. Check the connection.");
      return false;
    }

    if (!data.ok) {
      mark(file.name, "failed", data.refusal ?? "The upload was refused.");
      return false;
    }
    if (typeof data.left === "number") setLeft(data.left);
    mark(file.name, "done", `${formatBytes(file.size)} → ${formatBytes(full.size)}`);
    return true;
  }

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    if (!files.length) return;
    /* The same file picked twice in one batch would collide in the status list,
       which is keyed by name. */
    const seen = new Set<string>();
    const batch = files.filter((f) => !seen.has(f.name) && seen.add(f.name));

    setBusy(true);
    setRows(batch.map((f) => ({ name: f.name, state: "working", note: "resizing…" })));
    let landed = 0;
    /* One at a time, not Promise.all: the daily counter is read and written per
       request, and ten parallel uploads would all read the same count and all
       decide they were allowed. Sequential is also kinder to a hotel's uplink. */
    for (const file of batch) if (await send(file)) landed++;
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    /* Re-renders the server component so the new photos appear in the sheet and
       the gauge moves, without throwing away the status list above. */
    if (landed) router.refresh();
  }

  return (
    <div className="adm-bank-upload">
      <label className="adm-btn adm-btn--go" data-disabled={busy || left <= 0 ? "1" : undefined}>
        {busy ? "Uploading…" : "Add photos"}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.photo}
          multiple
          disabled={busy || left <= 0}
          onChange={onChange}
        />
      </label>

      <p className="adm-bank-left" data-state={left <= 0 ? "bad" : left <= 5 ? "warn" : "ok"}>
        {left <= 0
          ? `That is all ${CAPS.photo} for today. The limit resets at midnight.`
          : `${left} of ${CAPS.photo} left today`}
      </p>

      {rows.length > 0 && (
        <ul className="adm-bank-status" role="status">
          {rows.map((r) => (
            <li key={r.name} data-state={r.state}>
              <b>{r.name}</b>
              <span>{r.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

/* The file input for the admin's photo upload, and nothing else — the form
   around it is still a plain Server Action form.
 *
 * Two problems this solves at once, both learned the hard way from a 9 MB
 * camera original:
 *   1. A Server Action body over ~1 MB is killed at the transport, which
 *      surfaces as ERR_CONNECTION_RESET and an unhandled React error rather
 *      than the polite rejection the server-side size check was written for.
 *   2. Uploaded photos bypass next/image (the optimizer cannot fetch R2), so
 *      whatever is uploaded is exactly what every guest downloads. The seeded
 *      photos are 1600px at ~200-400 KB; an untouched original is 9 MB.
 *
 * So the browser resizes before the file is ever sent, to the same 1600px the
 * seeding script uses. No dependency, no paid image product, and the server's
 * size and magic-byte checks still stand behind it. */

const MAX_EDGE = 1600;

/* Under this, the file is sent untouched — it is already small enough to be
   both a fine upload and a fine download, and not re-encoding keeps a PNG a
   PNG and a WebP a WebP. */
const SHRINK_OVER = 900_000;

async function shrink(file: File): Promise<File> {
  /* from-image, because phones record rotation in EXIF rather than in the
     pixels, and a canvas that ignores it uploads every portrait photo on its
     side — permanently, since this is what gets stored. */
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  /* JPEG has no alpha, and an unpainted canvas is transparent — which composites
     to black. White is the one that looks like a mistake rather than a hole. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) return file;
  /* The name is thrown away by the server anyway — keys are UUIDs. */
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

export default function PhotoField() {
  const [note, setNote] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size <= SHRINK_OVER) {
      setNote(`${file.name} — ${kb(file.size)}`);
      return;
    }

    setNote(`Resizing ${file.name}…`);
    try {
      const small = await shrink(file);
      /* Swapping the input's own file keeps the surrounding <form action={…}>
         a plain Server Action form — no submit handler, no client state to
         thread through, nothing else about the upload changes. */
      const carrier = new DataTransfer();
      carrier.items.add(small);
      input.files = carrier.files;
      setNote(`${file.name} — resized, ${kb(file.size)} → ${kb(small.size)}`);
    } catch {
      /* Leave the original in place and say so. The server will refuse it for
         being too large, which is the correct outcome and a visible one. */
      setNote(`Could not resize ${file.name}. It may be too large to upload.`);
    }
  }

  return (
    <>
      <input
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        onChange={onChange}
      />
      {note && <small role="status">{note}</small>}
    </>
  );
}

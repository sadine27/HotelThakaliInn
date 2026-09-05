/* What counts as an uploadable file, and how much of it is allowed.
 *
 * Pure on purpose — no `cloudflare:workers`, no React — because the browser
 * needs these numbers to refuse a file before spending a minute uploading it,
 * and the server needs the identical numbers to refuse one that skipped the
 * browser. Same reasoning as lib/public-routes.ts: a limit written down twice
 * is a limit that will disagree with itself. The D1 side lives in
 * lib/media-store.ts, which is what actually needs a binding.
 *
 * The caps are not a cost control — R2 gives 10 GB free and a 1600px WebP is
 * ~200 KB, so the free tier holds roughly 17,800 photos. They are an accident
 * control: a stuck loop, a selected folder, a phone camera roll. What actually
 * guards the bill is the gauge on /admin/photos and the nightly size check,
 * because a number you can see beats a number you have to remember.
 */

export type Kind = "photo" | "video";

/* Hotel-wide per day, not per person: two staff each filling their own quota is
   the same bucket. Resets on Kathmandu midnight (see media_assets.day). */
export const CAPS: Record<Kind, number> = { photo: 30, video: 5 };

/* A photo arrives already resized to 1600px WebP by the browser (~200 KB), so
   2 MB is only ever hit by something that bypassed that. A video is uploaded as
   it is — nothing re-encodes it — so its ceiling is the real one: the existing
   gallery clips are 1.2-2.9 MB, and 25 MB is about eight seconds of 4K phone
   footage. */
export const MAX_BYTES: Record<Kind, number> = {
  photo: 2 * 1024 * 1024,
  video: 25 * 1024 * 1024,
};

/* Where the gauge turns red. 60% of the free 10 GB, which leaves room for the
   nightly mirror in workers/r2-backup to double every object and still fit. */
export const BANK_WARN_BYTES = 6 * 1024 * 1024 * 1024;
export const BANK_FREE_BYTES = 10 * 1024 * 1024 * 1024;

/* The client sends a MIME type it chose, and a .txt renamed to .jpg keeps its
   text/plain nowhere at all — so the file's own first bytes decide. Moved here
   from app/admin/content/page.tsx so the bank and the older per-row upload
   cannot drift apart about what a valid file is. */
const MAGIC: { mime: string; ext: string; kind: Kind; sig: number[]; at?: number }[] = [
  { mime: "image/jpeg", ext: "jpg", kind: "photo", sig: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", kind: "photo", sig: [0x89, 0x50, 0x4e, 0x47] },
  /* RIFF....WEBP — bytes 8-11 are checked separately below, because RIFF alone
     is also a .wav. */
  { mime: "image/webp", ext: "webp", kind: "photo", sig: [0x52, 0x49, 0x46, 0x46] },
  /* MP4 and friends put a four-byte length first, then 'ftyp' at offset 4. */
  { mime: "video/mp4", ext: "mp4", kind: "video", sig: [0x66, 0x74, 0x79, 0x70], at: 4 },
];

/* Camera negatives. The owner's shoot is 265 Sony .ARW files at 68 MB each, and
   every one has a .JPG twin sitting next to it. No browser can decode a raw
   negative, so it can be neither resized before upload nor displayed after —
   it would cost 68 MB to store something no guest could ever see. Caught by
   name as well as by bytes: TIFF magic is shared by several of these, and the
   extension is what makes the refusal specific enough to act on. */
const RAW_EXT = /\.(arw|cr2|cr3|nef|dng|raf|orf|rw2|srw|pef)$/i;
/* II*\0 and MM\0* — little- and big-endian TIFF, which is what most raw
   formats are underneath. */
const TIFF = [
  [0x49, 0x49, 0x2a, 0x00],
  [0x4d, 0x4d, 0x00, 0x2a],
];

export const RAW_REFUSAL =
  "That is a camera negative, not a photo the web can show. Upload the .JPG sitting next to it — same picture, and every browser can open it.";

const matches = (head: Uint8Array, sig: number[], at = 0) =>
  sig.every((b, i) => head[at + i] === b);

/* Answers with the file's real type, or with a sentence explaining the refusal
   in words the person holding the file can act on. Never an error code: this
   runs on a screen used by front-desk staff, and "unsupported media type" tells
   them nothing about what to do next. */
export function sniff(
  head: Uint8Array,
  filename: string,
): { mime: string; ext: string; kind: Kind } | { refusal: string } {
  if (RAW_EXT.test(filename) || TIFF.some((sig) => matches(head, sig))) {
    return { refusal: RAW_REFUSAL };
  }
  const hit = MAGIC.find((m) => matches(head, m.sig, m.at));
  if (!hit) {
    return {
      refusal: `“${filename}” is not a kind of file the site can show. Photos must be JPG, PNG or WebP; video must be MP4.`,
    };
  }
  if (hit.mime === "image/webp" && String.fromCharCode(...head.slice(8, 12)) !== "WEBP") {
    return { refusal: `“${filename}” says it is a WebP image but its contents are something else.` };
  }
  return { mime: hit.mime, ext: hit.ext, kind: hit.kind };
}

/* What the file input should offer. Kept beside MAGIC so adding a format is one
   edit, not two that get out of step. */
export const ACCEPT: Record<Kind, string> = {
  photo: "image/jpeg,image/png,image/webp",
  video: "video/mp4",
};

/* 0 B / 412 KB / 1.4 MB / 2.1 GB. The gauge is read at a glance by someone who
   does not think in bytes, so it never shows more than one decimal and never
   shows a unit smaller than the number deserves. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* Kathmandu midnight, said as a time rather than a timestamp — "come back
   after midnight" is the only part of a refused upload anyone needs. */
export const CAP_RESET = "midnight, Kathmandu time";

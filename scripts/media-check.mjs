/* One runnable check for the photo bank's rules: `node scripts/media-check.mjs`.
   Node strips the types off lib/media.ts natively — no framework, no deps.

   Everything pinned here decides whether a file is stored or refused, and both
   the browser and the server read these same functions. A break here is either
   a 68 MB negative accepted into a bucket that cannot display it, or a real
   photo turned away with a sentence the person holding it cannot act on. */

import assert from "node:assert/strict";
import { BANK_FREE_BYTES, CAPS, MAX_BYTES, RAW_REFUSAL, formatBytes, sniff } from "../lib/media.ts";

const bytes = (...b) => new Uint8Array([...b, ...Array(16 - b.length).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ARW = bytes(0x49, 0x49, 0x2a, 0x00);
const MP4 = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70);
/* RIFF, then WEBP at offset 8. */
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
/* RIFF, then WAVE — a sound file wearing an image's first four bytes. */
const WAVE = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0]);

/* The formats the site can actually show. */
assert.deepEqual(sniff(JPEG, "a.jpg"), { mime: "image/jpeg", ext: "jpg", kind: "photo" });
assert.deepEqual(sniff(PNG, "a.png"), { mime: "image/png", ext: "png", kind: "photo" });
assert.deepEqual(sniff(WEBP, "a.webp"), { mime: "image/webp", ext: "webp", kind: "photo" });
assert.deepEqual(sniff(MP4, "clip.mp4"), { mime: "video/mp4", ext: "mp4", kind: "video" });

/* The bytes decide, not the name — a .txt renamed to .jpg keeps its text/plain
   nowhere at all, and the browser will happily claim it is an image. */
assert.ok("refusal" in sniff(bytes(0x68, 0x65, 0x6c, 0x6c), "photo.jpg"));
/* RIFF alone is also a .wav, which is why bytes 8-11 are checked separately. */
assert.ok("refusal" in sniff(WAVE, "a.webp"));

/* A camera negative, caught both ways: by its TIFF header even when renamed,
   and by its extension even when the bytes are unfamiliar. 265 of these sit in
   the owner's shoot at 68 MB each, and no browser can decode one. */
assert.equal(sniff(ARW, "RBP01128.ARW").refusal, RAW_REFUSAL);
assert.equal(sniff(ARW, "renamed-without-extension").refusal, RAW_REFUSAL);
assert.equal(sniff(JPEG, "RBP01128.arw").refusal, RAW_REFUSAL, "lowercase .arw is still a negative");
assert.equal(sniff(bytes(0x00), "x.cr3").refusal, RAW_REFUSAL, "Canon raw too");

/* Every refusal is a sentence someone can act on, not a code. */
for (const bad of [sniff(WAVE, "a.webp"), sniff(bytes(0x68), "a.jpg"), sniff(ARW, "a.arw")]) {
  assert.ok(bad.refusal.length > 30 && /[.!]$/.test(bad.refusal), `not a sentence: ${bad.refusal}`);
}

/* The gauge is read by someone who does not think in bytes. */
assert.equal(formatBytes(0), "0 B");
assert.equal(formatBytes(900), "900 B");
assert.equal(formatBytes(204_800), "200 KB");
assert.equal(formatBytes(1_572_864), "1.5 MB");
assert.equal(formatBytes(BANK_FREE_BYTES), "10.00 GB");

/* The arithmetic the caps were chosen from: a resized photo is ~200 KB, the
   nightly r2-backup mirror doubles every object, and the free tier is 10 GB.
   If any of these move, the number on the screen stops matching the promise. */
const PER_PHOTO_MIRRORED = 225 * 1024 * 2;
assert.ok(
  (BANK_FREE_BYTES * 0.8) / PER_PHOTO_MIRRORED > 15_000,
  "the free tier should still hold well over 15,000 photos",
);
assert.ok(CAPS.photo * MAX_BYTES.photo < 100 * 1024 * 1024, "a maxed-out day must stay under 100 MB");
assert.ok(MAX_BYTES.video > 5 * MAX_BYTES.photo, "a clip needs far more room than a photo");
/* The existing gallery clips are 1.2-2.9 MB; the cap has to clear them easily
   or the feature they were made for cannot use them. */
assert.ok(MAX_BYTES.video > 3 * 1024 * 1024, "must comfortably fit the existing gallery clips");

/* The shipped-media manifest against the files actually in the repo. A photo
   added to public/media and not listed is a photo the picker cannot offer; a
   path listed and not on disk is a broken thumbnail in the bank. */
{
  const { readdirSync } = await import("node:fs");
  const { join, posix } = await import("node:path");
  const walk = (dir, base = "") =>
    readdirSync(join("public/media", dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name), posix.join(base, e.name))
        : [posix.join("/media", base, e.name)],
    );
  const onDisk = walk(".").sort();
  const { REPO_MEDIA } = await import("../lib/repo-media.ts");
  assert.deepEqual(
    [...REPO_MEDIA].sort(),
    onDisk,
    "lib/repo-media.ts is out of step with public/media — regenerate it",
  );
}

console.log("media-check: all assertions passed");

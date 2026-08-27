/* One-off: export the three room hero photos from the camera originals.
 *
 * The sources are ~8MB at 7008x4672 and live in assets/, outside public/. This
 * writes web-sized copies into public/media/rooms/ at the same weight as the
 * rest of public/media (100-640KB). sharp comes in with Next.js, so there is
 * nothing to install.
 *
 * Run once:  node scripts/export-room-photos.mjs
 * The outputs are what ship; this file exists to record how they were made.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "assets/Hotel Thakali Inn Reels n photos/DCIM/100MSDCF";
const OUT = "public/media/rooms";

/* Subjects confirmed against the property's Booking.com room listing. */
const PHOTOS = [
  ["RBP01178.JPG", "deluxe-double.jpg"], // twin beds, lamp between, framed peak
  ["RBP01260.JPG", "deluxe-king.jpg"], // king bed, two armchairs, tea station
  ["RBP01267.JPG", "family.jpg"], // king + 100cm single, wall of prints
];

await mkdir(OUT, { recursive: true });

for (const [from, to] of PHOTOS) {
  const info = await sharp(`${SRC}/${from}`)
    .resize({ width: 2000, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`${OUT}/${to}`);
  console.log(`${to}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

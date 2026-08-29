/* One-off: export the breakfast and amenities photos from the camera originals.
 *
 * Same shape as scripts/export-room-photos.mjs — the sources are ~7-9MB at
 * 7008x4672 in assets/, outside public/, and this writes web-sized copies at the
 * same weight as the rest of public/media. sharp comes in with Next.js.
 *
 * Run once:  node scripts/export-page-photos.mjs
 * The outputs are what ship; this file exists to record how they were made.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "assets/Hotel Thakali Inn Reels n photos/DCIM/100MSDCF";

/* Subjects from the shoot inventory, and each file is named for what is actually
   in the frame rather than for the row it lands on. That rule threw out two
   candidates:
     - RBP01368 is a fruit platter from the buffet, not a packed breakfast box.
       It ships as fruit.jpg and its alt text says so; the copy beside it can talk
       about packing without the photo pretending to be the box.
     - RBP01389 is the hotel's own facade. The amenity row it was meant for is
       "Airport main entrance — 1.1 km", which is a different building, so it is
       not exported at all. Staff can add it through the admin if they want it.
   The eight in-room amenities get no photo on purpose: a stock-feeling picture
   per fact is worse than a clean list. */
const PHOTOS = [
  ["public/media/breakfast", "RBP01337.JPG", "buffet.jpg"], // buffet area, full shot
  ["public/media/breakfast", "RBP01368.JPG", "fruit.jpg"], // fruit platter on the buffet
  ["public/media/breakfast", "RBP01402.JPG", "dining.jpg"], // dining area
  ["public/media/amenities", "RBP01396.JPG", "front-desk.jpg"], // front desk
];

for (const [out, from, to] of PHOTOS) {
  await mkdir(out, { recursive: true });
  const info = await sharp(`${SRC}/${from}`)
    /* 1600 rather than the rooms' 2000: these sit in a grid and a band, never
       full-bleed behind a hero, so the extra 400px is weight nothing renders. */
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`${out}/${to}`);
  console.log(`${out}/${to}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

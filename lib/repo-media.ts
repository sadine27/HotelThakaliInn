/* The photographs and clips that ship inside the site.
 *
 * These are files in `public/media`, served by the assets binding — not objects
 * in R2, not rows in `media_assets`, and not ours to delete from the admin.
 *
 * They used to be discovered by asking the content table which /media/ paths it
 * pointed at, which worked right up until somebody used the new picker to point
 * a card at something else: the old photo was then referenced by nothing, fell
 * out of the bank, and could not be chosen back. A one-way door, and the exact
 * kind this admin is being rebuilt to remove.
 *
 * A worker has no filesystem to list at runtime, so the list is written down.
 * `scripts/media-check.mjs` compares it against `public/media` on every
 * `npm run check`, so adding a file to the repo and forgetting this list fails
 * the build rather than quietly hiding the photo. */
export const REPO_MEDIA: string[] = [
  "/media/ambient.mp4",
  "/media/amenities/front-desk.jpg",
  "/media/breakfast/buffet.jpg",
  "/media/breakfast/dining.jpg",
  "/media/breakfast/fruit.jpg",
  "/media/gallery/arrival.jpg",
  "/media/gallery/arrival.mp4",
  "/media/gallery/bathrooms.jpg",
  "/media/gallery/bathrooms.mp4",
  "/media/gallery/bedside.jpg",
  "/media/gallery/bedside.mp4",
  "/media/gallery/breakfast.jpg",
  "/media/gallery/breakfast.mp4",
  "/media/gallery/buffet.jpg",
  "/media/gallery/buffet.mp4",
  "/media/gallery/corridor.jpg",
  "/media/gallery/corridor.mp4",
  "/media/gallery/dining.jpg",
  "/media/gallery/dining.mp4",
  "/media/gallery/lobby.jpg",
  "/media/gallery/lobby.mp4",
  "/media/gallery/minibar.jpg",
  "/media/gallery/minibar.mp4",
  "/media/gallery/rooms.jpg",
  "/media/gallery/rooms.mp4",
  "/media/gallery/signage.jpg",
  "/media/gallery/signage.mp4",
  "/media/gallery/window.jpg",
  "/media/gallery/window.mp4",
  "/media/hero/arrival.jpg",
  "/media/hero/breakfast.jpg",
  "/media/hero/desk.jpg",
  "/media/hero/rooms.jpg",
  "/media/menu/hotel-sketch.png",
  "/media/rooms/deluxe-double.jpg",
  "/media/rooms/deluxe-king.jpg",
  "/media/rooms/family.jpg",
  "/media/services/amenities.jpg",
  "/media/services/breakfast.jpg",
  "/media/services/contact.jpg",
  "/media/services/gallery.jpg",
  "/media/services/rooms.jpg",
];

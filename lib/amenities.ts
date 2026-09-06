/* The rules the amenity screen and the public page both obey.
 *
 * It lives in lib/ rather than beside the glyphs because scripts/amenity-check.mjs
 * imports it in plain Node — Node strips the types off a .ts, but it cannot
 * parse the JSX in a .tsx, so the data has to sit on this side of the line.
 * The components import it back; the drawing stays with them. */

/* A row's category is also its icon: the public page never reads a per-row
   icon, it looks the category up here. Which means the set of categories a
   row may belong to and the set of glyphs that exist are the same set, and an
   admin picker built from this object cannot offer a category that renders as
   a bare dot. Staff may still type one that isn't here — that is deliberate,
   and the screen says what it will look like. */
export const CATEGORY_ICONS: Record<string, string> = {
  Bathroom: "bathroom",
  "Food & Drink": "food",
  "Business Facilities": "business",
  "Safety & security": "safety",
  Outdoors: "outdoors",
  Kitchen: "kitchen",
  "Room amenities": "bed",
  Pets: "pets",
  Activities: "activities",
  "Living Area": "sofa",
  "Media & Technology": "media",
  Internet: "wifi",
  Parking: "parking",
  "Front Desk Services": "bell",
  "Cleaning Services": "sparkle",
  General: "info",
  "Languages Spoken": "globe",
};

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

/* The six little-touch symbols. The names, not only the type, because the save
   action checks against them at runtime — TouchGlyph has a `case` per name and
   a seventh would draw nothing at all. */
export const TOUCH_NAMES = ["cup", "fruit", "wine", "buffet", "minibar", "diet"] as const;
export type TouchName = (typeof TOUCH_NAMES)[number];

/* What an amenity keeps in `extra`. Both keys are absent rather than 0/"" when
   off, so a row that is in neither strip stores `{}` — the same value every
   amenity held before migration 0023, and the same thing lib/content.ts hands
   back for a row whose JSON is unreadable. */
export type AmenityExtra = { featured?: 1; touch?: TouchName };

const isTouch = (v: string): v is TouchName => (TOUCH_NAMES as readonly string[]).includes(v);

/* Called with what the form posted. `touch` arrives as a radio value, so the
   browser can only send one of the six or "" — but this action is reachable by
   a hand-crafted POST too, and a bad name would be written into the column and
   then read back by a page that renders nothing for it. Refused, not coerced:
   silently dropping it would take a row out of the touches strip with a green
   "Saved." on the screen. */
export function composeAmenityExtra(
  featured: boolean,
  touch: string,
): { extra: AmenityExtra } | { error: "touch" } {
  const extra: AmenityExtra = {};
  if (featured) extra.featured = 1;
  if (touch) {
    if (!isTouch(touch)) return { error: "touch" };
    extra.touch = touch;
  }
  return { extra };
}

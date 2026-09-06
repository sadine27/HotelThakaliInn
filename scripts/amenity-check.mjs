/* One runnable check for the amenity `extra` rules: `node scripts/amenity-check.mjs`.
   Same shape as scripts/menu-check.mjs — Node strips the types off lib/amenities.ts
   natively, no framework, no deps.

   composeAmenityExtra() is what stands between the amenities screen and the two
   strips at the top of the public page. Get it wrong and either the highlights
   grid empties out or a "little touch" is stored with a symbol TouchGlyph has no
   case for, which renders as nothing at all — both silent, both only visible to a
   guest. Hence the assertions.

   The category list is checked against the glyph map for the same reason: the
   admin picker is built from it, and a category with no glyph draws a bare dot. */

import assert from "node:assert/strict";
import { CATEGORIES, CATEGORY_ICONS, TOUCH_NAMES, composeAmenityExtra } from "../lib/amenities.ts";

/* ── The common case: 60-odd of the 68 rows are in neither strip. ── */
assert.deepEqual(composeAmenityExtra(false, ""), { extra: {} });

/* ── The two strips. Absent, not 0 — see the AmenityExtra comment. ── */
assert.deepEqual(composeAmenityExtra(true, ""), { extra: { featured: 1 } });
assert.deepEqual(composeAmenityExtra(false, "cup"), { extra: { touch: "cup" } });

/* Nothing forbids both. The seed puts no row in both, but a row that earns its
   way into the highlights while staying a touch is a decision for the screen,
   not a rule for this function. */
assert.deepEqual(composeAmenityExtra(true, "wine"), { extra: { featured: 1, touch: "wine" } });

/* ── Every one of the six is accepted, so a typo here fails the build rather
   than one button on the picker quietly doing nothing. ── */
for (const n of TOUCH_NAMES) {
  assert.deepEqual(composeAmenityExtra(false, n), { extra: { touch: n } }, `rejected ${n}`);
}

/* ── Refusals. A radio can only post one of the six; a crafted POST cannot. ── */
assert.deepEqual(composeAmenityExtra(false, "sandwich"), { error: "touch" });
assert.deepEqual(composeAmenityExtra(false, "CUP"), { error: "touch" });
assert.deepEqual(composeAmenityExtra(true, " cup"), { error: "touch" });

/* ── The round trip: a row opened and saved with nothing touched. ── */
for (const extra of [{}, { featured: 1 }, { touch: "diet" }, { featured: 1, touch: "minibar" }]) {
  const back = composeAmenityExtra(extra.featured === 1, extra.touch ?? "");
  assert.deepEqual(back, { extra }, `round trip changed ${JSON.stringify(extra)}`);
}

/* ── The picker's list and the glyph map are the same list. ── */
assert.equal(new Set(CATEGORIES).size, CATEGORIES.length, "CATEGORIES has a duplicate");
for (const c of CATEGORIES) assert.ok(CATEGORY_ICONS[c], `${c} has no glyph`);

console.log(
  `amenity-check ok — extra rules, ${TOUCH_NAMES.length} touch symbols, ${CATEGORIES.length} categories, round trip clean`,
);

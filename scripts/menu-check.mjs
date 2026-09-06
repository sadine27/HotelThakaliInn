/* One runnable check for the menu's price rules: `node scripts/menu-check.mjs`.
   Node strips the types off lib/menu.ts natively — no framework, no deps.

   composeMenuExtra() is the only thing standing between the price editor and
   the `extra` column. Get it wrong and a drink's four pours become one, or a
   whole tab of the Cuisine page starts printing "Rs. NaN". Both are silent:
   the save succeeds and the damage is a page nobody looks at until a guest
   does. Hence the assertions.

   The round trip matters as much as the rules — sizeRows() fills the editor
   from what composeMenuExtra() stored, so a drink opened and saved with nothing
   touched has to come back byte for byte. */

import assert from "node:assert/strict";
import { SIZE_NAMES, composeMenuExtra, sizeRows } from "../lib/menu.ts";

/* ── One price, no size name: the common case, and what every dish is. ── */
assert.deepEqual(composeMenuExtra([""], ["495"]), { extra: { price: 495 } });
/* Whitespace is not a name — an editor left with a stray space would otherwise
   flip a dish into a one-size "drink" and print a blank label beside it. */
assert.deepEqual(composeMenuExtra(["  "], ["495"]), { extra: { price: 495 } });

/* ── Several pours: what migration 0022 folded the bar list into. ── */
assert.deepEqual(
  composeMenuExtra(["30ml", "60ml", "180ml", "360ml"], ["820", "1550", "4550", "8550"]),
  {
    extra: {
      /* The first pour, not the cheapest by search and not zero: it is what
         every reader written before `sizes` existed still shows. */
      price: 820,
      sizes: [
        { label: "30ml", price: 820 },
        { label: "60ml", price: 1550 },
        { label: "180ml", price: 4550 },
        { label: "360ml", price: 8550 },
      ],
    },
  },
);

/* Sizes are not only volumes — the same merge covers Black/Milk, Per
   Glass/Per Bottle, Stick/Packet. Nothing here parses a number out of a name. */
assert.deepEqual(composeMenuExtra(["Black", "Milk"], ["50", "80"]), {
  extra: { price: 50, sizes: [{ label: "Black", price: 50 }, { label: "Milk", price: 80 }] },
});

/* ── A blank price is a line somebody added and did not fill in. ──
   Dropped, not stored as zero: that is what makes "Add a size" undoable by
   simply leaving it, with no second button to press. One named line that is
   left stays named — "Somersby Apple Cider" is sold in a 250ml bottle and
   nothing else, and printing "250ml Rs. 490" is the point. */
assert.deepEqual(composeMenuExtra(["30ml", ""], ["820", ""]), {
  extra: { price: 820, sizes: [{ label: "30ml", price: 820 }] },
});
assert.deepEqual(composeMenuExtra(["30ml", "60ml", ""], ["820", "1550", "  "]), {
  extra: { price: 820, sizes: [{ label: "30ml", price: 820 }, { label: "60ml", price: 1550 }] },
});

/* ── Refusals. Each one is a sentence on the screen, not a silent save. ── */
assert.deepEqual(composeMenuExtra([], []), { error: "price" });
assert.deepEqual(composeMenuExtra([""], [""]), { error: "price" });
assert.deepEqual(composeMenuExtra([""], ["free"]), { error: "price" });
assert.deepEqual(composeMenuExtra([""], ["-5"]), { error: "price" });
/* Past one line the name is what tells the pours apart on the page, so an
   unnamed one would print as a bare number against nothing. */
assert.deepEqual(composeMenuExtra(["30ml", ""], ["820", "1550"]), { error: "label" });
assert.deepEqual(composeMenuExtra(["30ml", "30ml"], ["820", "900"]), { error: "duplicate" });
assert.deepEqual(composeMenuExtra(["30ml", "30ML"], ["820", "900"]), { error: "duplicate" });

/* ── The round trip: open a row, change nothing, save. ── */
for (const extra of [
  { price: 495 },
  { price: 50, sizes: [{ label: "Black", price: 50 }, { label: "Milk", price: 80 }] },
  { price: 35, sizes: [{ label: "Stick", price: 35 }, { label: "Packet", price: 620 }] },
]) {
  const rows = sizeRows(extra);
  const back = composeMenuExtra(
    rows.map((r) => r.label),
    rows.map((r) => String(r.price)),
  );
  assert.deepEqual(back, { extra }, `round trip changed ${JSON.stringify(extra)}`);
}

/* A row written before this existed — or one hand-edited in D1 to nothing —
   opens as one empty-named line rather than an editor with no boxes in it. */
assert.deepEqual(sizeRows(undefined), [{ label: "", price: 0 }]);
assert.deepEqual(sizeRows({}), [{ label: "", price: 0 }]);

/* The datalist is a suggestion list, so a typo in it is only a worse
   suggestion — but a duplicate in it renders as two identical options. */
assert.equal(new Set(SIZE_NAMES).size, SIZE_NAMES.length, "SIZE_NAMES has a duplicate");

console.log(`menu-check ok — price rules, ${SIZE_NAMES.length} size names, round trip clean`);

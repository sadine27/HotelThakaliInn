/* One runnable check for the pure math: `node scripts/sparkline-check.mjs`.
   Node strips the types off lib/sparkline.ts natively — no framework, no deps. */

import assert from "node:assert/strict";
import { sparklinePoints, weekDelta } from "../lib/sparkline.ts";
import { waHref } from "../lib/site.ts";

/* The brief's pinned cases. */
assert.equal(sparklinePoints([0, 0, 0], 100, 40), "0,20 50,20 100,20"); // flat-line guard
assert.equal(sparklinePoints([0, 5, 10], 100, 40), "0,40 50,20 100,0"); // min-max spread
assert.equal(waHref("+977-1-4780090"), "https://wa.me/97714780090");

/* Edge cases. */
assert.equal(sparklinePoints([], 100, 40), "");
assert.equal(sparklinePoints([7], 100, 40), "0,20"); // single point, no NaN step

/* The week-over-week guard. */
assert.equal(weekDelta(0, 0), null);
assert.equal(weekDelta(15, 10), 50);
assert.equal(weekDelta(8, 10), -20);

console.log("sparkline-check: all assertions passed");

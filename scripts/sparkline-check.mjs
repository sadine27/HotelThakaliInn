/* One runnable check for the pure math: `node scripts/sparkline-check.mjs`.
   Node strips the types off lib/sparkline.ts natively — no framework, no deps. */

import assert from "node:assert/strict";
import { sparklinePoints, weekDelta } from "../lib/sparkline.ts";
import { normalizeEmail, waHref } from "../lib/site.ts";

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

/* The admin whitelist compares these strings literally, so a spelling that
   normalises differently on the two sides locks a real owner out. */
assert.equal(normalizeEmail("lsharma.banstola@googlemail.com"), "lsharma.banstola@gmail.com");
assert.equal(normalizeEmail("  Owner@Gmail.com \n"), "owner@gmail.com");
assert.equal(normalizeEmail("owner+admin@gmail.com"), "owner@gmail.com");
assert.equal(normalizeEmail("desk+tag@hotelthakaliinn.com"), "desk+tag@hotelthakaliinn.com"); // +tag is only Gmail's rule
assert.equal(normalizeEmail("not-an-email"), "not-an-email@"); // stays invalid for the caller's regex to reject

console.log("sparkline-check: all assertions passed");

/* ── The big chart's arithmetic (lib/chart.ts) ───────────────────────────────
   Same reason the sparkline is pinned here: it is drawing that nobody looks at
   closely enough to notice when it starts lying. */
const { niceScale, ticks, plot, polyline, area, axisIndices } = await import("../lib/chart.ts");

/* A scale people count in: 1, 2 or 5 times a power of ten. Not `max` itself,
   which puts the top gridline through the peak and makes every chart look
   about to overflow — and not a power of ten, which draws 0 and 100 for a
   chart whose biggest day was 12. */
assert.deepEqual(niceScale(12), { top: 15, step: 5 });
assert.deepEqual(niceScale(9), { top: 10, step: 5 });
assert.deepEqual(niceScale(100), { top: 100, step: 50 });
assert.deepEqual(niceScale(288), { top: 300, step: 100 });
/* Never a fractional step: every chart here counts things, and a quiet week
   would otherwise be given gridlines at 0, 0.5 and 1. */
assert.deepEqual(niceScale(1), { top: 1, step: 1 });
assert.deepEqual(niceScale(3), { top: 3, step: 1 });
/* An empty or impossible chart still needs an axis to draw against, and must
   never hand back a top of 0 for something else to divide by. */
assert.deepEqual(niceScale(0), { top: 1, step: 1 });
assert.deepEqual(niceScale(-5), { top: 1, step: 1 });
assert.deepEqual(niceScale(NaN), { top: 1, step: 1 });

/* y is already in SVG coordinates — 0 at the top — so no caller has to
   remember to flip it. */
assert.deepEqual(ticks(10, 5, 100), [
  { value: 0, y: 100 },
  { value: 5, y: 50 },
  { value: 10, y: 0 },
]);

const days = [
  { label: "Mon", count: 0 },
  { label: "Tue", count: 5 },
  { label: "Wed", count: 10 },
];
const pts = plot(days, 100, 40, 10);
assert.equal(polyline(pts), "0,40 50,20 100,0");
assert.equal(area(pts, 100, 40), "0,40 0,40 50,20 100,0 100,40");

/* One day is drawn in the middle, not at x=0 where half of it would sit off
   the edge of the chart. */
assert.deepEqual(plot([{ label: "Mon", count: 3 }], 100, 40, 10), [
  { x: 50, y: 28, value: 3, label: "Mon" },
]);
assert.deepEqual(plot([], 100, 40, 10), []);

/* The axis labels the first and last day whatever else it drops — those two
   are what make a date axis mean anything. */
assert.deepEqual(axisIndices(3, 400), [0, 1, 2]);
assert.deepEqual(axisIndices(0, 400), []);
assert.deepEqual(axisIndices(1, 400), [0]);
const thirty = axisIndices(30, 400);
assert.equal(thirty[0], 0);
assert.equal(thirty[thirty.length - 1], 29);
assert.ok(thirty.length <= 6, `too many labels for 400px: ${thirty.length}`);

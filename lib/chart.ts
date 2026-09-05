/* The arithmetic behind the big chart on /admin/analytics.
 *
 * lib/sparkline.ts stays as it is: 28 lines, no axis, no ticks, drawing the one
 * small line on the dashboard. This is the other job — a chart with a dated
 * axis and readable gridlines — and it is still arithmetic rather than a
 * dependency, because a charting library would be the largest thing in the
 * bundle for one drawing on one page only staff ever open.
 *
 * Pure by construction, like lib/sparkline.ts and lib/settings-schema.ts: no
 * imports, so scripts/sparkline-check.mjs can run it under bare node. */

/* A round number above the highest value, and the steps to get there.
 *
 * The naive version is `max` itself, which puts the top gridline through the
 * peak and makes every chart look like it is about to overflow. The other naive
 * version is Math.ceil to a power of ten, which draws 0 and 100 for a chart
 * whose values are all under 12. This picks 1, 2 or 5 times a power of ten —
 * the steps people actually count in.
 *
 * Never below 1, because every chart on this page counts things: a quiet week
 * whose busiest day was one view would otherwise be given gridlines at 0, 0.5
 * and 1, and half a page view is not a quantity. */
export function niceScale(max: number, targetTicks = 4): { top: number; step: number } {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, step: 1 };
  const rough = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag);
  return { top: Math.ceil(max / step) * step, step };
}

export type Tick = { value: number; y: number };

/* Gridline positions, top value included. `y` is already in SVG coordinates —
   0 at the top — so the caller never has to remember to flip it. */
export function ticks(top: number, step: number, height: number): Tick[] {
  const out: Tick[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) {
    out.push({ value: v, y: height - (v / top) * height });
  }
  return out;
}

export type Point = { x: number; y: number; value: number; label: string };

/* One point per day, evenly spaced across the full width. A single day sits in
   the middle rather than at x=0, where it would be drawn half off the edge. */
export function plot(
  values: { label: string; count: number }[],
  width: number,
  height: number,
  top: number,
): Point[] {
  const n = values.length;
  if (!n) return [];
  const gap = n === 1 ? 0 : width / (n - 1);
  return values.map((v, i) => ({
    x: n === 1 ? width / 2 : Math.round(i * gap * 10) / 10,
    y: Math.round((height - (v.count / top) * height) * 10) / 10,
    value: v.count,
    label: v.label,
  }));
}

export const polyline = (points: Point[]): string => points.map((p) => `${p.x},${p.y}`).join(" ");

/* The same line closed along the bottom, so the fill sits under it rather than
   being a second shape that can drift out of step with it. */
export const area = (points: Point[], width: number, height: number): string =>
  points.length ? `0,${height} ${polyline(points)} ${points[points.length - 1].x},${height}` : "";

/* How many dated labels the axis can carry without them colliding, given how
   wide each one draws. Returns the indices to label, always including the first
   and the last: those two are what make the axis mean anything. */
export function axisIndices(n: number, width: number, labelWidth = 78): number[] {
  if (n <= 1) return n === 1 ? [0] : [];
  const room = Math.max(2, Math.floor(width / labelWidth));
  if (n <= room) return Array.from({ length: n }, (_, i) => i);
  const stride = Math.ceil((n - 1) / (room - 1));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += stride) out.push(i);
  out.push(n - 1);
  return out;
}

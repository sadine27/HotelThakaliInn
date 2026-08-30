/* The sparkline's arithmetic, kept free of every import so a plain-node script
   (scripts/sparkline-check.mjs) can exercise it without Cloudflare bindings.
   The SVG only consumes the string this returns — nothing here draws. */

export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const fmt = (n: number) => Number(n.toFixed(1));
  const flat = max === min;
  return values
    .map((v, i) => {
      const x = i * step;
      /* A flat series (all zeros, or one point) must not divide by zero — draw it
         as a flat line at mid-height instead. */
      const y = flat ? height / 2 : height - ((v - min) / (max - min)) * height;
      return `${fmt(x)},${fmt(y)}`;
    })
    .join(" ");
}

/* Week-over-week as a rounded percentage. Null when the prior week had nothing:
   "+100% against zero" is the classic dashboard lie, and Infinity is worse. */
export function weekDelta(thisWeek: number, lastWeek: number): number | null {
  if (lastWeek === 0) return null;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

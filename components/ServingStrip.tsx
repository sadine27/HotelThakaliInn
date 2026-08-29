"use client";

import { useLive } from "@/components/Live";

/* Minutes since local midnight. Every comparison on this page goes through this
   rather than through Date objects, because Kathmandu is UTC+5:45 and any
   arithmetic on the offset itself eventually gets the :45 wrong. The clock this
   reads is already Kathmandu's, so there is no conversion left to do. */
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export default function ServingStrip({ from, to }: { from: string; to: string }) {
  const live = useLive();

  /* Nothing until /api/live answers, and nothing at all if it never does. The
     rest of the page states the window as a plain fact either way — the live
     layer is additive, and a page that only makes sense with it is a page that
     breaks when an upstream does. */
  if (!live) return null;

  const now = mins(live.time);
  const open = mins(from);
  const close = mins(to);

  let note: string;
  if (now >= open && now < close) note = `Being served now, until ${to}`;
  else if (now < open && open - now <= 60) note = `Being laid out — ${open - now} minutes`;
  else if (now < open) note = `From ${from} this morning`;
  else note = `Tomorrow, ${from}`;

  const serving = now >= open && now < close;

  return (
    /* role="status" rather than "alert": this updates as the clock crosses a
       boundary, and a screen reader should mention it when it gets there rather
       than interrupt whatever is being read. */
    <p className="bf-now" role="status" data-serving={serving ? "" : undefined}>
      <span className="bf-now-dot" aria-hidden="true" />
      {note}
    </p>
  );
}

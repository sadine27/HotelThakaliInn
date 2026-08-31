"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { TZ, type Live, type SkyKey } from "@/lib/live";

/* The site's present tense, shared.
 *
 * Two jobs, one fetch. The provider stamps `data-daypart` on <html> so every
 * page's palette follows the real hour in Kathmandu — the same mechanism DialNav
 * already uses for the open dial, so the whole colour shift is CSS and costs no
 * animation code. And it hands the payload to whatever wants to print it.
 *
 * Why a context and not a hook called twice: two callers would mean two fetches
 * and two clocks that disagree by a second. There is exactly one live moment.
 */

const LiveCtx = createContext<Live | null>(null);

/* Null until the first response lands, and null forever if the route is down.
   Every consumer has to handle that, which is the point — the live layer is
   additive, and the site has to read correctly with none of it. */
export const useLive = () => useContext(LiveCtx);

/* Ten minutes. The upstream is cached for fifteen, so polling faster only
   re-reads the same numbers; this is slow enough to be free and fast enough
   that a guest who leaves the tab open overnight still sees the sun come up. */
const POLL = 600_000;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/live");
        if (!res.ok) return;
        const next = (await res.json()) as Live;
        if (alive) setLive(next);
      } catch {
        /* Offline, or the route is down. Keep whatever we last had rather than
           blanking the strip — a slightly old temperature beats a flicker. */
      }
    };

    load();
    const poll = setInterval(load, POLL);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    /* Set in an effect rather than at render, and never on the server: the
       daypart depends on the moment the page is looked at, so rendering it into
       the HTML would hydrate into a mismatch the first time a cached response
       outlived its own hour. LiquidBackground documents the same trap. */
    if (!live) return;
    const el = document.documentElement;
    el.dataset.daypart = live.daypart;
    /* The second axis, same mechanism: the hour moves the ground (--bg and
       friends), the sky moves the atmosphere on top of it (--sky-*), and the
       two own different variables so they can never fight. A missing sky key
       deletes the attribute — a weather outage leaves the palette exactly
       where the daypart put it. */
    if (live.skyKey) el.dataset.sky = live.skyKey;
    else delete el.dataset.sky;
    return () => {
      delete el.dataset.daypart;
      delete el.dataset.sky;
    };
  }, [live]);

  return <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>;
}

/* What the hour means for someone reading this at that hour. An airport hotel's
   one real question is "will anybody be awake when I land", and the answer is
   most reassuring at exactly the time it is least believable.

   Hardcoded rather than a settings row: these four strings are welded to the
   daypart logic above, and a staff edit that leaves one blank would leave the
   strip's second half empty. Move them into `settings` when someone asks. */
const NOTE: Record<Live["daypart"], string> = {
  dawn: "Breakfast is going on now",
  day: "Reception open, rooms ready",
  dusk: "Kitchen open, front desk staffed",
  night: "Front desk awake — late arrivals are normal here",
};

/* Only the skies that change what an airport guest does next get a sentence —
   clear, cloudy and snow need none. Same register as NOTE and the same rule:
   every fact is one the seeded copy already claims (the 950 m terminal, the
   paid shuttle, flights running late). Nothing invented. */
const SKY: Partial<Record<SkyKey, string>> = {
  fog: "Fog over the valley — flights can run late",
  rain: "Raining in Kathmandu — the terminal is 950 m from the front door",
  storm: "A storm is passing — ask the front desk about the airport shuttle",
};

/* The clock, ticked locally. It lives here rather than in the provider because a
   minute tick in the provider would re-render every consumer, and the hero it
   sits in is running four framer-motion carousels. */
function useClock(seed: string | undefined) {
  /* Only what this hook has ticked itself, never the seed copied into state.
     Holding the seed as well meant re-seeding from an effect every time the
     provider refetched, which is a cascading render to arrive at the value the
     render already had. Falling back to `seed` at the bottom does the same job
     with no state and no effect body, and a tick that has already happened is
     newer than any seed that arrives after it. */
  const [ticked, setTicked] = useState<string>();

  useEffect(() => {
    if (!seed) return;

    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTicked(fmt.format(new Date()));

    let timer: ReturnType<typeof setInterval>;
    /* Aligned to the wall clock instead of ticking every 60s from whenever the
       page loaded, so the digit flips when the minute actually changes. */
    const align = setTimeout(
      () => {
        tick();
        timer = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );

    return () => {
      clearTimeout(align);
      clearInterval(timer);
    };
  }, [seed]);

  return ticked ?? seed;
}

/* The facts, on the eyebrow line: hour, sky, air. Deliberately no prose — it
   shares a row with the hotel's name, and the row's height is load-bearing on
   short viewports (see --card-min-h in globals.css). */
export default function LiveLine() {
  const live = useLive();
  const time = useClock(live?.time);

  /* Renders nothing until the first response. The row it sits in is sized by the
     brand eyebrow beside it, so there is no reflow when this appears. */
  if (!live || !time) return null;

  return (
    <p className="live">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-time">
        <span className="sr-only">Kathmandu time </span>
        {time}
      </span>
      {live.temp !== null && (
        <span className="live-fact">
          {live.temp}°{live.sky ? ` ${live.sky}` : ""}
        </span>
      )}
      {live.air && (
        <span className="live-fact">
          <span className="sr-only">Air quality index </span>
          {live.aqi} {live.air}
        </span>
      )}
    </p>
  );
}

/* The prose half, parked under the booking buttons rather than up in the
   eyebrow. It is the answer to the question the CTA is about to be clicked
   over, so it belongs where the click happens. */
export function LiveNote() {
  const live = useLive();
  if (!live) return null;
  const sky = live.skyKey ? SKY[live.skyKey] : undefined;
  return (
    <p className="live-note">
      {NOTE[live.daypart]}
      {sky ? ` · ${sky}` : ""}
    </p>
  );
}

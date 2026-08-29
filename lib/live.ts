/* The shape of the live payload, and the one timezone the site runs on.
 *
 * In its own file so both sides can import it: the route builds this, the client
 * strip prints it. Importing the type straight from the route would drag D1 and
 * `cloudflare:workers` into the client's module graph the first time a bundler
 * declined to erase a type-only import. */

export const TZ = "Asia/Kathmandu";

/* The six appearances the sky can take, grouped by the route from the 28 WMO
   weather codes. The human label ships beside it as `sky`; this is the half the
   client stamps on <html> as [data-sky] — styling off human strings is how a
   palette breaks the day someone rewords "Partly cloudy". */
export type SkyKey = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export type Live = {
  /* "HH:MM" in Kathmandu, so the client has a correct first value without
     having to trust the visitor's clock. It ticks it forward itself after. */
  time: string;
  daypart: "dawn" | "day" | "dusk" | "night";
  /* Null whenever the upstream is unreachable. The strip drops the field; it
     never renders "—°" or a stale number, because a wrong fact about the
     weather makes every other fact on the page suspect. */
  temp: number | null;
  sky: string | null;
  skyKey: SkyKey | null;
  aqi: number | null;
  air: string | null;
};

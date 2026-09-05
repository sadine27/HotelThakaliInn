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
  /* Not live in the sense the rest of this is, but it travels with them: the
     floating WhatsApp button is mounted in the root layout, which cannot read
     D1 without making every page dynamic. Empty string when staff clear the
     settings row — the button then does not render at all. */
  phone: string;
  /* The number the WhatsApp button opens, which is not always the number the
     site prints — a hotel can answer WhatsApp on a different handset. Resolved
     server-side against the whatsapp_same switch, so every consumer gets one
     ready-to-use number rather than the rule for picking between two. */
  whatsapp: string;
  /* Same reasoning as phone: the footer is mounted in the root layout, which
     cannot read D1 without making every page dynamic, so the accounts ride
     along with the rest of the live payload instead of a second fetch. */
  socials: { label: string; href: string }[];
  address: string;
  email: string;
  /* Resolved server-side from the two rain_glass_day/rain_glass_night settings
     rows against the daypart just computed, so RainGlass only has to check one
     flag instead of also knowing which of the two rows applies right now. */
  rainGlass: boolean;
};

/* "YYYY-MM-DD" in Kathmandu. Everything that has to agree on what "today" means
   — the view beacon writing a row, the dashboard counting them back — goes
   through this one function, because the site's day rolls over at Kathmandu
   midnight and the server's does not. en-CA is ISO order by definition, so this
   needs no padding or reassembly. */
export const kathmanduDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/* "YYYY-MM-DD HH:MM:SS" in Kathmandu, the shape SQLite stores and sorts as text.
   The page_views table already had created_at in UTC and nothing ever read it:
   "which hour of the day does traffic land in" is a question about the hotel's
   day, and an hour bucket computed in UTC is 5h45m wrong for every row. */
export const kathmanduNow = (date = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const at = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${at("year")}-${at("month")}-${at("day")} ${at("hour")}:${at("minute")}:${at("second")}`;
};

/* N days back from a Kathmandu day, as another Kathmandu day. Date arithmetic
   in UTC on a noon anchor: noon is far enough from either midnight that the
   :45 offset can never push it into the wrong date. */
export const kathmanduDayBefore = (days: number, from = new Date()) => {
  const [y, m, d] = kathmanduDay(from).split("-").map(Number);
  return kathmanduDay(new Date(Date.UTC(y, m - 1, d - days, 12)));
};

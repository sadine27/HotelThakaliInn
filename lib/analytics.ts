import { env } from "cloudflare:workers";
import { kathmanduDayBefore } from "@/lib/live";

/* The named page-view queries behind the admin dashboard, so the page renders
   numbers instead of carrying five SQL strings. Error contract, same as the
   rest of the app: null means the query THREW (table missing, D1 unreachable)
   and must not read as a number; [] means a legitimate empty answer. A wrong
   fact is worse than no fact. */

/* One daily-counts query serves today, the two 7-day windows and the 30-day
   line — one round trip instead of four. `day` is Kathmandu-local (the same
   helper /api/view stamps rows with). */
export async function dailyCounts(
  daysBack = 29,
  now = new Date(),
): Promise<Map<string, number> | null> {
  return env.DB.prepare(
    "SELECT day, COUNT(*) as count FROM page_views WHERE day >= ? GROUP BY day ORDER BY day",
  )
    .bind(kathmanduDayBefore(daysBack, now))
    .all<{ day: string; count: number }>()
    .then((r) => new Map(r.results.map((d) => [d.day, d.count])))
    .catch(() => null);
}

export async function topPages(
  cutoff: string,
  limit = 5,
): Promise<{ path: string; count: number }[]> {
  return env.DB.prepare(
    `SELECT path, COUNT(*) as count FROM page_views WHERE day >= ? GROUP BY path ORDER BY count DESC LIMIT ${limit}`,
  )
    .bind(cutoff)
    .all<{ path: string; count: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

/* Direct traffic (empty referrer) is reported as its own bucket, never mixed
   into the list as a blank row. */
export async function topReferrers(
  cutoff: string,
  limit = 5,
): Promise<{ referrer: string; count: number }[]> {
  return env.DB.prepare(
    `SELECT referrer, COUNT(*) as count FROM page_views WHERE day >= ? AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT ${limit}`,
  )
    .bind(cutoff)
    .all<{ referrer: string; count: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

export async function directCount(cutoff: string): Promise<number | null> {
  return env.DB.prepare(
    "SELECT COUNT(*) as count FROM page_views WHERE day >= ? AND referrer = ''",
  )
    .bind(cutoff)
    .first<{ count: number }>()
    .then((r) => r?.count ?? null)
    .catch(() => null);
}

export async function viewSpan(): Promise<{ first: string | null; total: number } | null> {
  return env.DB.prepare("SELECT MIN(day) as first, COUNT(*) as total FROM page_views")
    .first<{ first: string | null; total: number }>()
    .then((r) => r ?? null)
    .catch(() => null);
}

/* Thirty slots whether or not anything landed in them, oldest first. A quiet
   day has to be drawn as a zero rather than left out, or the line closes the
   gap and a dead Tuesday looks like a busy one. Takes the already-fetched
   daily Map — it must never re-query. */
export function sparklineSeries(
  byDay: Map<string, number>,
  days = 30,
  now = new Date(),
): { day: string; count: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = kathmanduDayBefore(days - 1 - i, now);
    return { day, count: byDay.get(day) ?? 0 };
  });
}

/* ── The detail view ─────────────────────────────────────────────────────────
   Everything below reads the columns migration 0020 added. Same error contract
   as above: null means the query THREW, [] means a legitimate empty answer.
   Rows written before 0020 have empty strings in every one of these columns,
   which is why "unknown" is a value these panels can show rather than a case
   they fall over on. */

/* How many DIFFERENT people, not how many page loads. Impossible before there
   was a visitor id — a refresh was simply two visits.
 *
 * Rows written before migration 0020 have an empty id, and COUNT(DISTINCT
 * visitor) counted every one of them as a single extra person: 249 anonymous
 * rows read as "1 person, 249 views". Hence the CASE — and hence `attributed`
 * as its own figure, because dividing ALL views by only the identified people
 * is what produced "58.3 pages each" from a five-page visit. */
export async function uniqueVisitors(
  cutoff: string,
): Promise<{ people: number; views: number; attributed: number; unattributed: number } | null> {
  return env.DB.prepare(
    `SELECT COUNT(DISTINCT CASE WHEN visitor != '' THEN visitor END) AS people,
            COUNT(*)                                                AS views,
            SUM(CASE WHEN visitor != '' THEN 1 ELSE 0 END)          AS attributed,
            SUM(CASE WHEN visitor  = '' THEN 1 ELSE 0 END)          AS unattributed
       FROM page_views WHERE day >= ?`,
  )
    .bind(cutoff)
    .first<{ people: number; views: number; attributed: number; unattributed: number }>()
    .then((r) => r ?? null)
    .catch(() => null);
}

/* Someone who has been here on more than one day. Two visits an hour apart is
   one visit as far as a hotel is concerned; coming back tomorrow is the thing
   worth knowing. */
export async function returningVisitors(cutoff: string): Promise<number | null> {
  return env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT visitor FROM page_views
        WHERE day >= ? AND visitor != ''
        GROUP BY visitor HAVING COUNT(DISTINCT day) > 1
     )`,
  )
    .bind(cutoff)
    .first<{ n: number }>()
    .then((r) => r?.n ?? null)
    .catch(() => null);
}

export async function topCountries(
  cutoff: string,
  limit = 8,
): Promise<{ country: string; people: number; views: number }[]> {
  return env.DB.prepare(
    `SELECT country,
            COUNT(DISTINCT CASE WHEN visitor != '' THEN visitor END) AS people,
            COUNT(*) AS views
       FROM page_views WHERE day >= ?
       GROUP BY country ORDER BY views DESC LIMIT ${limit}`,
  )
    .bind(cutoff)
    .all<{ country: string; people: number; views: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

export async function deviceSplit(
  cutoff: string,
): Promise<{ device: string; views: number }[]> {
  return env.DB.prepare(
    "SELECT device, COUNT(*) AS views FROM page_views WHERE day >= ? GROUP BY device ORDER BY views DESC",
  )
    .bind(cutoff)
    .all<{ device: string; views: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

/* Twenty-four buckets and seven, both cut on the Kathmandu clock — which is why
   `at` exists and created_at (UTC) is not used. Empty `at` is a pre-0020 row
   with no time of day at all, and counting it as midnight would invent a spike. */
export async function byHour(cutoff: string): Promise<{ hour: number; views: number }[]> {
  return env.DB.prepare(
    `SELECT CAST(substr(at, 12, 2) AS INTEGER) AS hour, COUNT(*) AS views
       FROM page_views WHERE day >= ? AND at != ''
       GROUP BY hour ORDER BY hour`,
  )
    .bind(cutoff)
    .all<{ hour: number; views: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

/* SQLite's strftime('%w') is 0 = Sunday. The panel relabels to a Monday start;
   the query stays in the database's own vocabulary. */
export async function byWeekday(cutoff: string): Promise<{ dow: number; views: number }[]> {
  return env.DB.prepare(
    `SELECT CAST(strftime('%w', day) AS INTEGER) AS dow, COUNT(*) AS views
       FROM page_views WHERE day >= ? GROUP BY dow ORDER BY dow`,
  )
    .bind(cutoff)
    .all<{ dow: number; views: number }>()
    .then((r) => r.results)
    .catch(() => []);
}

export type VisitorRow = {
  visitor: string;
  views: number;
  first_at: string;
  last_at: string;
  country: string;
  city: string;
  region: string;
  network: string;
  device: string;
  browser: string;
};

/* One row per person rather than per page load, newest first. MAX(...) picks
   the geography off whichever row SQLite reads last within the group — fine
   here, because these five values do not change within one visitor: they are
   all derived from the address and agent the id itself was hashed from. */
export async function recentVisitors(cutoff: string, limit = 40): Promise<VisitorRow[]> {
  return env.DB.prepare(
    `SELECT visitor,
            COUNT(*)     AS views,
            MIN(at)      AS first_at,
            MAX(at)      AS last_at,
            MAX(country) AS country,
            MAX(city)    AS city,
            MAX(region)  AS region,
            MAX(network) AS network,
            MAX(device)  AS device,
            MAX(browser) AS browser
       FROM page_views WHERE day >= ? AND visitor != ''
       GROUP BY visitor ORDER BY last_at DESC LIMIT ${limit}`,
  )
    .bind(cutoff)
    .all<VisitorRow>()
    .then((r) => r.results)
    .catch(() => []);
}

/* One person's path through the site, in the order they walked it. Capped
   because a bot that slipped past the broom can have hundreds of rows and the
   panel is a story, not a log. */
export async function visitorJourney(
  visitor: string,
  limit = 60,
): Promise<{ path: string; at: string }[]> {
  return env.DB.prepare(
    `SELECT path, at FROM page_views WHERE visitor = ?1 ORDER BY id LIMIT ${limit}`,
  )
    .bind(visitor)
    .all<{ path: string; at: string }>()
    .then((r) => r.results)
    .catch(() => []);
}

/* The address, on its own, for one visitor — never selected by the list above.
   It is fetched only when someone with the capability presses SHOW IP, so the
   page's HTML does not carry addresses that nobody asked to see. */
export async function visitorAddress(visitor: string): Promise<string | null> {
  return env.DB.prepare(
    "SELECT ip FROM page_views WHERE visitor = ?1 AND ip != '' ORDER BY id DESC LIMIT 1",
  )
    .bind(visitor)
    .first<{ ip: string }>()
    .then((r) => r?.ip ?? null)
    .catch(() => null);
}

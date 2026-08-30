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

import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { endSession, requireSession } from "@/lib/auth";
import { kathmanduDay, kathmanduDayBefore } from "@/lib/live";
import { directCount, dailyCounts, sparklineSeries, topPages as topPagesQuery, topReferrers, viewSpan as viewSpanQuery } from "@/lib/analytics";
import { sparklinePoints, weekDelta } from "@/lib/sparkline";

export const dynamic = "force-dynamic";

/* A panel you press, in the settings console's idiom rather than the flat grey
   card this used to be — the same reasoning the owner gave for that rebuild:
   if the screen looks unserious, the work done on it is treated as unserious.
   A number that could not be read (the query threw) shows a dash, never a 0. */
function Tile({ href, label, description, primary, secondaryLabel, secondary, accent = false }: {
  href: string;
  label: string;
  description: string;
  primary: number | null;
  secondaryLabel?: string;
  secondary?: number | null;
  accent?: boolean;
}) {
  return (
    <Link href={href} className="adm-tile" data-accent={accent ? "1" : undefined}>
      <span className="adm-tile-label">{label}</span>
      {primary !== null && <span className="adm-tile-number">{primary}</span>}
      <span className="adm-tile-desc">{description}</span>
      {secondaryLabel && secondary !== null && secondary !== undefined && (
        <span className="adm-tile-secondary">
          {secondaryLabel} <strong>{secondary}</strong>
        </span>
      )}
    </Link>
  );
}

/* What a path is called out loud. Staff know these pages by their names, not by
   their URLs, and "/" is the worst offender. */
const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/rooms": "Rooms",
  "/breakfast": "Breakfast",
  "/amenities": "Amenities",
  "/gallery": "Gallery",
  "/contact": "Contact",
  "/book": "Book a room",
};
const pageName = (path: string) => PAGE_NAMES[path] ?? path;

/* Thirty days of counts as one line. An inline polyline rather than a charting
   library: it is a dozen lines of arithmetic and no dependency, where the
   library would be the largest thing in the bundle for one drawing on one page
   nobody but staff ever loads. */
function Sparkline({ series, trend }: { series: { day: string; count: number }[]; trend: "up" | "down" | "flat" }) {
  const W = 640;
  const H = 56;
  const peak = Math.max(1, ...series.map((d) => d.count));
  const points = sparklinePoints(series.map((d) => d.count), W, H);
  return (
    <svg
      className="adm-spark"
      data-trend={trend}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Daily views over the last ${series.length} days. Busiest day: ${peak}.`}
    >
      {/* Area first, so the line draws on top of its own shading. */}
      <polygon className="adm-spark-fill" points={`0,${H} ${points} ${W},${H}`} />
      <polyline className="adm-spark-line" points={points} />
    </svg>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const pct = weekDelta(now, before);
  /* No previous week means no comparison to make. "+100%" against zero is the
     classic dashboard lie, so this says the honest thing instead. */
  if (pct === null) return <span className="adm-delta adm-delta--flat">no week before this</span>;
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return (
    <span className={`adm-delta adm-delta--${dir}`}>
      <span aria-hidden="true">{dir === "up" ? "↑" : dir === "down" ? "↓" : "→"}</span>{" "}
      {Math.abs(pct)}% vs the week before
    </span>
  );
}

export default async function Admin() {
  const { role } = await requireSession();

  const now = new Date();
  const kathmanduToday = kathmanduDay(now);
  const kathmanduSevenDaysAgo = kathmanduDayBefore(7, now);

  function formatHumanDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [ty, tm, td] = kathmanduToday.split('-').map(Number);
    const arrival = Date.UTC(y, m - 1, d);
    const diffDays = Math.round((arrival - Date.UTC(ty, tm - 1, td)) / 86_400_000);
    const human = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(arrival));
    let when: string;
    if (diffDays === 0) when = 'today';
    else if (diffDays === 1) when = 'tomorrow';
    else when = `in ${diffDays} days`;
    return { human, when };
  }

  /* One query of daily counts answers five of the six questions below — today,
     this week, last week, the shape of the line, and every gap in it — so it is
     one round trip rather than five. It reaches back fourteen days because the
     week-over-week comparison needs the week before the week. */
  const since7 = kathmanduDayBefore(6, now);
  const prevFrom = kathmanduDayBefore(13, now);
  const prevTo = kathmanduDayBefore(7, now);

  const [requestsUpcoming, requestsLast7, messagesTotal, messagesLast7, settingsCount, contentPublished, contentHidden, auditLast7, nextArrival, daily, topPages, topRefs, viewSpan, direct] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as count FROM booking_requests WHERE check_in >= ?`).bind(kathmanduToday).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM booking_requests WHERE substr(created_at, 1, 10) >= ?`).bind(kathmanduSevenDaysAgo).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM messages`).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM messages WHERE substr(created_at, 1, 10) >= ?`).bind(kathmanduSevenDaysAgo).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM settings`).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM content WHERE published = 1`).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM content WHERE published = 0`).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) as count FROM audit_log WHERE substr(created_at, 1, 10) >= ?`).bind(kathmanduSevenDaysAgo).first<{ count: number }>()
      .then(r => r?.count ?? 0).catch(() => null),
    env.DB.prepare(`SELECT name, check_in FROM booking_requests WHERE check_in >= ? ORDER BY check_in ASC LIMIT 1`).bind(kathmanduToday).first<{ name: string; check_in: string }>()
      .then(r => r ?? null).catch(() => null),
    dailyCounts(29, now),
    topPagesQuery(since7),
    topReferrers(since7),
    viewSpanQuery(),
    directCount(since7),
  ]);

  /* Null only when the query threw — the table missing, D1 unreachable. An empty
     table comes back as an empty array and reads as the legitimate zero it is. */
  const counting = daily !== null;
  const byDay = daily ?? new Map();
  const sum = (from: string, to: string) =>
    [...byDay.entries()].reduce((n, [day, count]) => (day >= from && day <= to ? n + count : n), 0);

  const viewsToday = byDay.get(kathmanduToday) ?? 0;
  const views7 = sum(since7, kathmanduToday);
  const viewsPrev7 = sum(prevFrom, prevTo);
  const viewsAll = viewSpan?.total ?? 0;

  const series = sparklineSeries(byDay, 30, now);
  const sparkPct = weekDelta(views7, viewsPrev7);
  const sparkTrend: "up" | "down" | "flat" = sparkPct === null || sparkPct === 0 ? "flat" : sparkPct > 0 ? "up" : "down";

  const busiest = Math.max(0, ...series.map((s) => s.count));
  const firstDay = viewSpan?.first ?? null;

  /* One divisor for every bar in the referrer list, direct traffic included —
     a separate max would let a bar overflow its track when direct is the
     biggest source. */
  const refMax = Math.max(direct ?? 0, topRefs[0]?.count ?? 0);

  async function signOut() {
    "use server";
    /* Yes, even here. Not because signing out an intruder is a loss, but because
       "requireSession() first, every action, no exceptions" is a rule that only
       works if it has no exceptions to remember. */
    await requireSession();
    await endSession();
    redirect("/admin/login");
  }

  return (
    <div className="adm-page adm-con">
      <h1>Manage the site</h1>
      <p className="adm-sub">Everything here is live the moment you save it</p>

      <nav className="adm-hub">
        <div className="adm-tiles">
          <Tile
            href="/admin/requests"
            label="Booking requests"
            description="Direct requests from the booking page, by arrival date"
            primary={requestsUpcoming}
            secondaryLabel="last 7 days"
            secondary={requestsLast7}
            accent={(requestsUpcoming ?? 0) > 0}
          />
          <Tile
            href="/admin/messages"
            label="Enquiries"
            description="Messages sent from the contact form"
            primary={messagesTotal}
            secondaryLabel="last 7 days"
            secondary={messagesLast7}
            accent={(messagesLast7 ?? 0) > 0}
          />
          <Tile
            href="/admin/settings"
            label="Contact & facts"
            description="Address, phone, email, arrival distances, what every room has"
            primary={settingsCount}
          />
          <Tile
            href="/admin/content"
            label="Pages, rooms & photos"
            description="The words and pictures on every page"
            primary={contentPublished}
            secondaryLabel="hidden"
            secondary={contentHidden}
          />
          {(role === "owner" || role === "developer") && (
            <Tile
              href="/admin/audit"
              label="Audit log"
              description="Every admin write, last 7 days — who, what, when"
              primary={auditLast7}
            />
          )}
          {(role === "owner" || role === "developer") && (
            <Tile
              href="/admin/accounts"
              label="Accounts"
              description="Who can sign in with Google, and as what role"
              primary={null}
            />
          )}
        </div>
        <div className="adm-next-arrival">
          {nextArrival ? (
            (() => {
              const { human, when } = formatHumanDate(nextArrival.check_in);
              return (
                <>
                  Next arrival: <strong>{nextArrival.name}</strong> — <strong>{when}</strong> ({human})
                </>
              );
            })()
          ) : (
            <>No upcoming arrivals</>
          )}
        </div>
      </nav>

      <section className="adm-stats">
        <header className="adm-stats-head">
          <h2>Who is reading the site</h2>
          <p>
            Every page a visitor opens, counted here. No names, no location, no
            cookie — this cannot tell you who anyone is, only which pages get
            read and where the reader came from.
          </p>
        </header>

        {!counting ? (
          <p className="adm-stats-empty">
            Counting is not running — the database could not be reached.
          </p>
        ) : (
          <>
            <div className="adm-figures">
              <div className="adm-figure">
                <span className="adm-figure-n">{viewsToday}</span>
                <span className="adm-figure-l">today</span>
                <span className="adm-figure-s">since midnight in Kathmandu</span>
              </div>
              <div className="adm-figure">
                <span className="adm-figure-n">{views7}</span>
                <span className="adm-figure-l">last 7 days</span>
                <span className="adm-figure-s">
                  <Delta now={views7} before={viewsPrev7} />
                </span>
              </div>
              <div className="adm-figure">
                <span className="adm-figure-n">{viewsAll}</span>
                <span className="adm-figure-l">all time</span>
                <span className="adm-figure-s">
                  {firstDay ? `since ${firstDay}` : "nothing counted yet"}
                </span>
              </div>
            </div>

            <figure className="adm-spark-wrap">
              <Sparkline series={series} trend={sparkTrend} />
              <figcaption>
                <span>{series[0].day}</span>
                <span className="adm-spark-peak">
                  {busiest === 0 ? "no views yet" : `busiest day: ${busiest}`}
                </span>
                <span>today</span>
              </figcaption>
            </figure>

            <div className="adm-lists">
              <div className="adm-list">
                <h3>Most read, last 7 days</h3>
                {topPages.length === 0 ? (
                  <p className="adm-list-empty">Nothing yet this week.</p>
                ) : (
                  <ol>
                    {topPages.map((p) => (
                      <li key={p.path}>
                        <span className="adm-list-name">{pageName(p.path)}</span>
                        <span className="adm-list-bar" aria-hidden="true">
                          <i style={{ width: `${(p.count / topPages[0].count) * 100}%` }} />
                        </span>
                        <span className="adm-list-n">{p.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="adm-list">
                <h3>Where they came from</h3>
                {topRefs.length === 0 && (direct === null || direct === 0) ? (
                  <p className="adm-list-empty">
                    Nobody arrived from another site this week. They typed the
                    address, used a bookmark, or followed a link that hides where
                    it came from — most apps do.
                  </p>
                ) : (
                  <ol>
                    {direct !== null && direct > 0 && (
                      <li key="direct">
                        <span className="adm-list-name">Typed the address themselves</span>
                        <span className="adm-list-bar" aria-hidden="true">
                          <i style={{ width: `${(direct / refMax) * 100}%` }} />
                        </span>
                        <span className="adm-list-n">{direct}</span>
                      </li>
                    )}
                    {topRefs.map((r) => (
                      <li key={r.referrer}>
                        <span className="adm-list-name">{r.referrer}</span>
                        <span className="adm-list-bar" aria-hidden="true">
                          <i style={{ width: `${(r.count / refMax) * 100}%` }} />
                        </span>
                        <span className="adm-list-n">{r.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <p className="adm-stats-note">
              Counting started {firstDay ?? "today"}. There is nothing before
              that and nothing can be recovered — the visits that happened before
              this existed were never written down.
            </p>
          </>
        )}
      </section>

      <form action={signOut} className="adm-signout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}

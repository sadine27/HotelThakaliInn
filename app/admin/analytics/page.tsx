import { env } from "cloudflare:workers";
import { Fragment } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { getActor, requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { kathmanduDay, kathmanduDayBefore } from "@/lib/live";
import {
  byHour,
  byWeekday,
  dailyCounts,
  deviceSplit,
  recentVisitors,
  returningVisitors,
  sparklineSeries,
  topCountries,
  topPages as topPagesQuery,
  topReferrers,
  uniqueVisitors,
  visitorAddress,
  visitorJourney,
} from "@/lib/analytics";
import { area, axisIndices, niceScale, plot, polyline, ticks } from "@/lib/chart";

export const dynamic = "force-dynamic";

/* The detail behind the dashboard's three numbers.
 *
 * It is its own page rather than more of the dashboard because the dashboard is
 * the first screen anyone opens in the morning and should stay one round trip.
 * This one asks eleven questions of the database and is opened on purpose.
 *
 * The address column is the only part of it that is gated: country, city and
 * network are everyone's, the raw IP is the developer's or an owner's for 24
 * hours, and pressing SHOW IP writes an audit row naming who looked. */

const WINDOWS = { "7": 7, "30": 30, "90": 90, all: 3650 } as const;
type WindowKey = keyof typeof WINDOWS;
const isWindow = (v: string): v is WindowKey => v in WINDOWS;
const WINDOW_LABEL: Record<WindowKey, string> = {
  "7": "7 days",
  "30": "30 days",
  "90": "90 days",
  all: "all time",
};

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/rooms": "Rooms",
  "/breakfast": "Breakfast",
  "/amenities": "Amenities",
  "/gallery": "Gallery",
  "/contact": "Contact",
  "/cuisine": "Cuisine",
  "/book": "Book a room",
};
const pageName = (path: string) => PAGE_NAMES[path] ?? path;

/* Nepal, India and the eight countries this hotel's guests actually come from,
   plus whatever else turns up. Two letters is a code, not an answer. */
const COUNTRY_NAMES: Record<string, string> = {
  NP: "Nepal",
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  CN: "China",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  AE: "United Arab Emirates",
  QA: "Qatar",
  MY: "Malaysia",
  TH: "Thailand",
  CA: "Canada",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  BT: "Bhutan",
  T1: "Tor network",
};
const countryName = (code: string) => (code ? (COUNTRY_NAMES[code] ?? code) : "Unknown");

/* Monday first: a week that starts on Sunday reads as two weekends with the
   working days squashed between them. SQLite's %w is 0 = Sunday. */
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* "2026-09-05 14:22:31" → "5 Sep, 14:22". The seconds are noise on a screen
   about which afternoon somebody visited. */
function stamp(at: string): string {
  if (!at) return "—";
  const [d, t = ""] = at.split(" ");
  const [, m, day] = d.split("-");
  const month = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] ?? m;
  return `${Number(day)} ${month}, ${t.slice(0, 5)}`;
}

/* Minutes between two stamps, for the gaps in a journey. Both are Kathmandu
   wall-clock and compared to each other, so no zone conversion is involved. */
function gapMinutes(a: string, b: string): number | null {
  const x = Date.parse(a.replace(" ", "T") + "Z");
  const y = Date.parse(b.replace(" ", "T") + "Z");
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 60000) : null;
}

function Bars({
  rows,
  emptyText,
}: {
  rows: { name: string; n: number; sub?: string }[];
  emptyText: string;
}) {
  if (!rows.length) return <p className="adm-list-empty">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="adm-an-bars">
      {rows.map((r) => (
        <li key={r.name}>
          <span className="adm-list-name" title={r.name}>
            {r.name}
            {r.sub && <em>{r.sub}</em>}
          </span>
          <span className="adm-list-bar" aria-hidden="true">
            <i style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="adm-list-n">{r.n}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; open?: string; ip?: string }>;
}) {
  const session = await requireSession();
  const ipAccess = await can(session, "analytics.ip");
  const { w, open, ip: ipParam } = await searchParams;

  const win: WindowKey = w && isWindow(w) ? w : "30";
  const days = WINDOWS[win];
  const now = new Date();
  const today = kathmanduDay(now);
  const cutoff = kathmanduDayBefore(days - 1, now);

  const [daily, unique, returning, countries, devices, hours, weekdays, visitors, pages, refs] =
    await Promise.all([
      dailyCounts(days - 1, now),
      uniqueVisitors(cutoff),
      returningVisitors(cutoff),
      topCountries(cutoff),
      deviceSplit(cutoff),
      byHour(cutoff),
      byWeekday(cutoff),
      recentVisitors(cutoff),
      topPagesQuery(cutoff, 10),
      topReferrers(cutoff, 10),
    ]);

  const counting = daily !== null;
  const series = sparklineSeries(daily ?? new Map(), days, now);

  /* Opened rows and revealed addresses are one at a time and live in the URL,
     so this whole screen stays a server component and a reload does not silently
     re-reveal an address nobody asked for twice. */
  const openVisitor = typeof open === "string" && /^[0-9a-f]{4,16}$/.test(open) ? open : null;
  const journey = openVisitor ? await visitorJourney(openVisitor) : [];

  /* The address is fetched only when it is asked for, so the page's HTML never
     carries one nobody pressed for — and the press is written down.
   *
   * The prefetch guard is not paranoia: Next.js prefetches every <Link> it can
   * see, which fetched three of these the moment the table rendered. Three
   * addresses were revealed and three audit rows written saying a person had
   * looked at them, and nobody had. The links below now carry prefetch={false};
   * this is the second lock, because a router that changes its mind about when
   * to prefetch must not be able to forge an audit trail.
   *
   * One press can still land two rows: a client-side navigation fetches the RSC
   * payload and the document separately, and both are real requests that really
   * did return the address. That is over-recording, which is the direction to
   * err in -- the promise on /privacy is that no reveal goes unwritten, not
   * that each one is written exactly once. A plain GET writes exactly one. */
  const isPrefetch = (await headers()).get("Next-Router-Prefetch") === "1";
  let revealed: string | null = null;
  const wantIp =
    !isPrefetch && typeof ipParam === "string" && /^[0-9a-f]{4,16}$/.test(ipParam) ? ipParam : null;
  if (wantIp && ipAccess.allowed) {
    revealed = await visitorAddress(wantIp);
    await env.DB.prepare(
      `INSERT INTO audit_log (actor, action, section, slug, before, after)
       VALUES (?1, 'analytics.reveal_ip', 'page_views', ?2, NULL, NULL)`,
    )
      .bind(await getActor(), wantIp)
      .run()
      .catch(() => {});
  }

  const W = 900;
  const H = 220;
  const peak = Math.max(...series.map((s) => s.count), 0);
  const { top, step } = niceScale(peak);
  const points = plot(
    series.map((s) => ({ label: s.day, count: s.count })),
    W,
    H,
    top,
  );
  const gridlines = ticks(top, step, H);
  const labelled = new Set(axisIndices(series.length, W));

  const people = unique?.people ?? 0;
  const viewsInWindow = unique?.views ?? 0;
  const attributed = unique?.attributed ?? 0;
  const unattributed = unique?.unattributed ?? 0;
  const repeatPct = people > 0 && returning !== null ? Math.round((returning / people) * 100) : null;

  const hourMax = Math.max(1, ...hours.map((h) => h.views));
  const dayMax = Math.max(1, ...weekdays.map((d) => d.views));
  const weekdayViews = new Map(weekdays.map((d) => [d.dow, d.views]));
  const hourViews = new Map(hours.map((h) => [h.hour, h.views]));

  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    p.set("w", win);
    if (openVisitor) p.set("open", openVisitor);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/admin/analytics?${p.toString()}`;
  };

  return (
    <div className="adm-page adm-con">
      <h1>Who is reading the site</h1>
      <p className="adm-sub">
        Counted at the edge — no cookie, no third party, nothing that follows anyone off this
        site. What is kept, and for how long, is written out on{" "}
        <Link href="/privacy">the privacy page</Link>.
      </p>

      <div className="adm-an-windows" role="group" aria-label="How far back to look">
        {(Object.keys(WINDOWS) as WindowKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin/analytics?w=${k}`}
            prefetch={false}
            className="adm-btn adm-btn--sm"
            aria-current={k === win ? "true" : undefined}
          >
            {WINDOW_LABEL[k]}
          </Link>
        ))}
      </div>

      {!counting && (
        <p className="adm-con-warn">Counting is not running — the database could not be reached.</p>
      )}

      <fieldset className="adm-con-panel">
        <legend>Views over {WINDOW_LABEL[win]}</legend>
        <figure className="adm-an-chart">
          <svg viewBox={`0 0 ${W + 74} ${H + 34}`} role="img" aria-label={`Views per day over ${WINDOW_LABEL[win]}. Busiest day: ${peak}.`}>
            <g transform="translate(42, 8)">
              {gridlines.map((t) => (
                <g key={t.value}>
                  <line className="adm-an-grid" x1="0" y1={t.y} x2={W} y2={t.y} />
                  <text className="adm-an-ylabel" x="-8" y={t.y + 4} textAnchor="end">
                    {t.value}
                  </text>
                </g>
              ))}
              <polygon className="adm-an-area" points={area(points, W, H)} />
              <polyline className="adm-an-line" points={polyline(points)} />
              {/* One circle per day with its own <title>: the browser's native
                  tooltip is a hover readout that needs no JavaScript, and this
                  page is a server component. */}
              {points.map((p) => (
                <circle key={p.label} className="adm-an-dot" cx={p.x} cy={p.y} r="7">
                  <title>{`${p.label}: ${p.value} ${p.value === 1 ? "view" : "views"}`}</title>
                </circle>
              ))}
              {points.map((p, i) =>
                labelled.has(i) ? (
                  <text key={`x-${p.label}`} className="adm-an-xlabel" x={p.x} y={H + 20} textAnchor="middle">
                    {p.label.slice(5)}
                  </text>
                ) : null,
              )}
            </g>
          </svg>
          <figcaption>
            Busiest day {peak}. Dates are month–day, Kathmandu time. Hover a point for its count.
          </figcaption>
        </figure>
      </fieldset>

      <fieldset className="adm-con-panel">
        <legend>People, not page loads</legend>
        <div className="adm-figures">
          <div className="adm-figure">
            <span className="adm-figure-n">{people}</span>
            <span className="adm-figure-l">different people</span>
            <span className="adm-figure-s">over {WINDOW_LABEL[win]}</span>
          </div>
          <div className="adm-figure">
            <span className="adm-figure-n">{viewsInWindow}</span>
            <span className="adm-figure-l">pages opened</span>
            <span className="adm-figure-s">
              {/* Attributed views over identified people. Dividing ALL views by
                  the people we could name reports a five-page visit as fifty. */}
              {people > 0 ? `${(attributed / people).toFixed(1)} pages each` : "—"}
            </span>
          </div>
          <div className="adm-figure">
            <span className="adm-figure-n">{returning ?? 0}</span>
            <span className="adm-figure-l">came back</span>
            <span className="adm-figure-s">
              {repeatPct === null ? "—" : `${repeatPct}% returned on another day`}
            </span>
          </div>
        </div>
        {unattributed > 0 && (
          <p className="adm-con-hint">
            {unattributed} {unattributed === 1 ? "view was" : "views were"} counted before visitors
            could be told apart, so {unattributed === 1 ? "it is" : "they are"} not in the people
            figure. Nothing before that can be recovered — it was never written down.
          </p>
        )}

        <div className="adm-an-two">
          <div className="adm-list">
            <h3>Where in the world</h3>
            <Bars
              rows={countries.map((c) => ({
                name: countryName(c.country),
                n: c.views,
                sub: c.people
                  ? `${c.people} ${c.people === 1 ? "person" : "people"}`
                  : "counted before visitors were told apart",
              }))}
              emptyText="No locations recorded yet in this window."
            />
          </div>
          <div className="adm-list">
            <h3>On what</h3>
            <Bars
              rows={devices
                .filter((d) => d.device)
                .map((d) => ({ name: d.device, n: d.views }))}
              emptyText="No device recorded yet in this window."
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-con-panel">
        <legend>When they come</legend>
        <p className="adm-con-hint">
          Kathmandu time. This is the useful one for deciding when the enquiry inbox needs somebody
          watching it.
        </p>
        <div className="adm-an-strip" aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => {
            const n = hourViews.get(h) ?? 0;
            return (
              <span key={h} className="adm-an-cell" data-on={n > 0 ? "1" : undefined}>
                <i style={{ height: `${Math.max(n ? 8 : 2, (n / hourMax) * 100)}%` }} />
                <b>{h % 6 === 0 ? `${h}:00` : ""}</b>
              </span>
            );
          })}
        </div>
        <p className="adm-an-legend">
          {hours.length === 0
            ? "No times recorded yet — every view in this window predates the clock."
            : `Busiest hour: ${hourViews.size ? [...hourViews.entries()].sort((a, b) => b[1] - a[1])[0][0] : 0}:00.`}
        </p>

        <div className="adm-an-strip adm-an-strip--week" aria-hidden="true">
          {WEEK_ORDER.map((d) => {
            const n = weekdayViews.get(d) ?? 0;
            return (
              <span key={d} className="adm-an-cell" data-on={n > 0 ? "1" : undefined}>
                <i style={{ height: `${Math.max(n ? 8 : 2, (n / dayMax) * 100)}%` }} />
                <b>{DOW[d]}</b>
              </span>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="adm-con-panel">
        <legend>What they read</legend>
        <div className="adm-an-two">
          <div className="adm-list">
            <h3>Most read</h3>
            <Bars
              rows={pages.map((p) => ({ name: pageName(p.path), n: p.count }))}
              emptyText="Nothing read yet in this window."
            />
          </div>
          <div className="adm-list">
            <h3>Where they came from</h3>
            <Bars
              rows={refs.map((r) => ({ name: r.referrer, n: r.count }))}
              emptyText="Nobody arrived from another site. They typed the address, used a bookmark, or followed a link that hides where it came from — most apps do."
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-con-panel">
        <legend>Every visitor</legend>
        <p className="adm-con-hint">
          One row per person, newest first. Open one to see the path they walked through the site.
          {ipAccess.allowed
            ? " You can reveal an address; each time you do is written to the audit log."
            : " The address itself is the developer's — country, city and network are here for everyone."}
        </p>
        {visitors.length === 0 ? (
          <p className="adm-con-empty">No visitors recorded in this window.</p>
        ) : (
          <div className="adm-matrix-wrap">
            <table className="adm-an-table">
              <thead>
                <tr>
                  <th scope="col">Visitor</th>
                  <th scope="col">Where from</th>
                  <th scope="col">On</th>
                  <th scope="col">Pages</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => {
                  const isOpen = openVisitor === v.visitor;
                  const place = [v.city, countryName(v.country)].filter(Boolean).join(", ");
                  return (
                    /* A keyed Fragment, not <>: two sibling rows per visitor
                       still need one key between them. */
                    <Fragment key={v.visitor}>
                      <tr data-open={isOpen ? "1" : undefined}>
                        <th scope="row">
                          <Link href={link({ open: isOpen ? null : v.visitor, ip: null })} prefetch={false}>
                            <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span> {v.visitor}
                          </Link>
                          {revealed && wantIp === v.visitor && (
                            <span className="adm-an-ip">{revealed}</span>
                          )}
                          {ipAccess.allowed && !(revealed && wantIp === v.visitor) && (
                            <Link className="adm-an-reveal" href={link({ ip: v.visitor })} prefetch={false}>
                              show IP
                            </Link>
                          )}
                        </th>
                        <td>
                          {place || "Unknown"}
                          {v.network && <em>{v.network}</em>}
                        </td>
                        <td>
                          {v.device || "—"}
                          {v.browser && <em>{v.browser}</em>}
                        </td>
                        <td className="adm-an-num">{v.views}</td>
                        <td>{stamp(v.last_at)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="adm-an-journey">
                          <td colSpan={5}>
                            <ol>
                              {journey.map((h, i) => {
                                const gap = i > 0 ? gapMinutes(journey[i - 1].at, h.at) : null;
                                return (
                                  <li key={`${h.at}-${i}`}>
                                    <span>{pageName(h.path)}</span>
                                    <em>{stamp(h.at)}</em>
                                    {gap !== null && gap > 0 && <b>+{gap} min</b>}
                                  </li>
                                );
                              })}
                            </ol>
                            {journey.length === 0 && <p>Nothing recorded for this visitor.</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      <p className="adm-con-hint">
        Everything on this page covers {cutoff} to {today}, Kathmandu time.
      </p>
    </div>
  );
}

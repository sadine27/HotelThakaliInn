import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { endSession, requireSession } from "@/lib/auth";
import { TZ } from "@/lib/live";

export const dynamic = "force-dynamic";

function Tile({ href, label, description, primary, secondaryLabel, secondary, accent = false }: {
  href: string;
  label: string;
  description: string;
  primary: number | null;
  secondaryLabel?: string;
  secondary?: number | null;
  accent?: boolean;
}) {
  const hasPrimary = primary !== null;
  return (
    <Link href={href} className={`adm-tile ${accent ? 'adm-tile--accent' : ''}`}>
      {hasPrimary && <div className="adm-tile-number">{primary}</div>}
      <div className="adm-tile-label">{label}</div>
      <div className="adm-tile-desc">{description}</div>
      {secondaryLabel && secondary !== null && secondary !== undefined && (
        <div className="adm-tile-secondary">
          {secondaryLabel}: <strong>{secondary}</strong>
        </div>
      )}
    </Link>
  );
}

export default async function Admin() {
  await requireSession();

  // Kathmandu date helpers
  function getKathmanduDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return {
      year: parseInt(parts.find(p => p.type === 'year')!.value, 10),
      month: parseInt(parts.find(p => p.type === 'month')!.value, 10),
      day: parseInt(parts.find(p => p.type === 'day')!.value, 10),
    };
  }
  function formatKathmanduDate(year: number, month: number, day: number) {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const now = new Date();
  const todayParts = getKathmanduDateParts(now);
  const kathmanduToday = formatKathmanduDate(todayParts.year, todayParts.month, todayParts.day);
  const offsetMs = (5 * 60 + 45) * 60 * 1000;
  const noonKathmanduUTC = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 12) - offsetMs;
  const sevenDaysAgoDate = new Date(noonKathmanduUTC);
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
  const sevenDaysAgoParts = getKathmanduDateParts(sevenDaysAgoDate);
  const kathmanduSevenDaysAgo = formatKathmanduDate(sevenDaysAgoParts.year, sevenDaysAgoParts.month, sevenDaysAgoParts.day);

  function formatHumanDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const arrivalDate = new Date(Date.UTC(y, m - 1, d));
    const arrivalKathmanduParts = getKathmanduDateParts(arrivalDate);
    const arrivalKathmandu = new Date(Date.UTC(arrivalKathmanduParts.year, arrivalKathmanduParts.month - 1, arrivalKathmanduParts.day));
    const todayKathmandu = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
    const diffDays = Math.round((arrivalKathmandu.getTime() - todayKathmandu.getTime()) / (24 * 60 * 60 * 1000));
    const human = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(arrivalKathmandu);
    let when: string;
    if (diffDays === 0) when = 'today';
    else if (diffDays === 1) when = 'tomorrow';
    else when = `in ${diffDays} days`;
    return { human, when };
  }

  // Queries
  const [requestsUpcoming, requestsLast7, messagesTotal, messagesLast7, settingsCount, contentPublished, contentHidden, nextArrival] = await Promise.all([
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
    env.DB.prepare(`SELECT name, check_in FROM booking_requests WHERE check_in >= ? ORDER BY check_in ASC LIMIT 1`).bind(kathmanduToday).first<{ name: string; check_in: string }>()
      .then(r => r ?? null).catch(() => null),
  ]);

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
    <div className="adm-page">
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
            label="Contact details & property facts"
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

      <form action={signOut} className="adm-signout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}

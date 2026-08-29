import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { TZ } from "@/lib/live";

export const dynamic = "force-dynamic";

type Request = {
  id: number;
  name: string;
  email: string;
  phone: string;
  room: string;
  guests: number;
  check_in: string;
  check_out: string;
  notes: string;
  created_at: string;
};

export default async function Requests() {
  await requireSession();

  /* A booking request is read differently from an enquiry: staff scan dates and
     rooms, not prose. Ordered by arrival date, not by submission — the useful
     question is "who is coming next", and a request for next week matters more
     than one that came in five minutes ago for March. */
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, room, guests, check_in, check_out, notes, created_at
     FROM booking_requests ORDER BY check_in ASC, id DESC LIMIT 200`,
  ).all<Request>();

  /* Today in Kathmandu, string-compared — the dates are stored as YYYY-MM-DD
     Kathmandu days by the endpoint, so this marks exactly the rows whose stay
     has already begun. */
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Booking requests</h1>
      <p className="adm-sub">
        {results.length === 0
          ? "Nothing yet"
          : `${results.length} request${results.length > 1 ? "s" : ""}, by arrival date`}
      </p>

      {results.length === 0 && (
        <p className="adm-empty">
          When someone fills in the form on the booking page, it appears here.
        </p>
      )}

      <ul className="adm-messages">
        {results.map((r) => {
          const past = r.check_in < today;
          return (
            <li key={r.id} data-past={past || undefined}>
              <p className="adm-meta">
                <time dateTime={r.check_in}>
                  {r.check_in} → {r.check_out}
                </time>
                {past && <span className="adm-past"> · past</span>}
              </p>
              <p className="adm-from">
                {/* Encoded for the same reason as the messages page: the guest
                    chose this string and it is going into a mailto URL. */}
                <a href={`mailto:${encodeURIComponent(r.email)}`}>{r.name}</a>{" "}
                <span>
                  {r.email}
                  {r.phone ? ` · ${r.phone}` : ""}
                </span>
              </p>
              <p className="adm-body">
                {r.room} · {r.guests} guest{r.guests > 1 ? "s" : ""}
                {r.notes ? `\n${r.notes}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

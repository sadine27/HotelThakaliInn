import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Message = {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export default async function Messages({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  /* Newest first, capped. No pagination, because an 18-room hotel will not have
     a thousand of these — and the LIMIT is what stops one runaway bot filling
     the page instead of the screen. */
  const { results: all } = await env.DB.prepare(
    "SELECT id, name, email, message, created_at FROM messages ORDER BY id DESC LIMIT 200",
  ).all<Message>();

  const needle = query.toLowerCase();
  const results = needle
    ? all.filter((m) => [m.name, m.email, m.message].some((v) => v.toLowerCase().includes(needle)))
    : all;

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Enquiries</h1>
      <p className="adm-sub">
        {all.length === 0
          ? "Nothing yet"
          : `${all.length} message${all.length > 1 ? "s" : ""}, newest first`}
      </p>

      {all.length > 0 && (
        <form className="adm-search" action="/admin/messages">
          <input type="search" name="q" placeholder="Search name, email or message…" defaultValue={query} />
          <button type="submit">Search</button>
        </form>
      )}

      {all.length === 0 && (
        <p className="adm-empty">
          When someone fills in the form on the contact page, it appears here.
        </p>
      )}

      {all.length > 0 && results.length === 0 && (
        <p className="adm-empty">Nothing matches “{query}”.</p>
      )}

      <ul className="adm-messages">
        {results.map((m) => (
          <li key={m.id}>
            <p className="adm-meta">
              {/* Stored by SQLite's datetime('now'), which is UTC. Said out loud
                  rather than converted: a timestamp that silently claims to be
                  local is worse than one that admits which clock it is on. */}
              <time dateTime={`${m.created_at.replace(" ", "T")}Z`}>{m.created_at} UTC</time>
            </p>
            {/* mailto, because replying is the only thing anyone does with one
                of these and the reply-to on the notification mail already goes
                to the same place.

                Encoded, not interpolated. A mailto URL takes ?subject=&body=&bcc=
                after the address, and the guest chose this string — so an address
                like "x?subject=Pay+here&bcc=someone@example.com" would turn a
                staff member's reply into a composer full of someone else's words
                and recipients. /api/contact rejects those characters now, but
                rows written before it did are still in this table, so the escape
                belongs here too. (encodeURIComponent also escapes the @ as %40,
                which RFC 6068 requires clients to decode.) */}
            <p className="adm-from">
              <a href={`mailto:${encodeURIComponent(m.email)}`}>{m.name}</a>{" "}
              <span>{m.email}</span>
            </p>
            {/* white-space: pre-wrap in the CSS — guests use line breaks, and
                collapsing them turns a readable enquiry into a wall. */}
            <p className="adm-body">{m.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

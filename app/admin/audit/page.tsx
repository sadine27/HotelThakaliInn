import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LIMIT = 200;

type Row = {
  id: number;
  created_at: string;
  actor: string;
  action: string;
  section: string | null;
  slug: string | null;
  before: string | null;
  after: string | null;
  archived_at: string | null;
};

/* Every filter is optional and additive — an empty search box means "all". A
   parameterized WHERE built from a fixed set of known columns, not raw SQL
   from the query string: search params only ever supply values, never column
   names or operators. */
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    section?: string;
    actor?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireSession();
  const { action, section, actor, from, to } = await searchParams;

  const clauses: string[] = [];
  const binds: string[] = [];
  let n = 0;
  const add = (clause: string, value: string) => {
    n++;
    clauses.push(clause.replace("?", `?${n}`));
    binds.push(value);
  };
  if (action) add("action = ?", action);
  if (section) add("section = ?", section);
  if (actor) add("actor = ?", actor);
  if (from) add("created_at >= ?", from);
  if (to) add("created_at <= ?", to);

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results: rows } = await env.DB.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ${LIMIT}`,
  )
    .bind(...binds)
    .all<Row>();

  const { results: actions } = await env.DB.prepare(
    "SELECT DISTINCT action FROM audit_log ORDER BY action",
  ).all<{ action: string }>();
  const { results: actors } = await env.DB.prepare(
    "SELECT DISTINCT actor FROM audit_log ORDER BY actor",
  ).all<{ actor: string }>();

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Audit log</h1>
      <p className="adm-sub">
        Every admin write, permanently. Rows land in the same transaction as
        the change they describe, and are copied to a write-once archive on a
        short delay — the "archived" column below shows whether that copy has
        happened yet.
      </p>

      <form className="adm-toolbar" action="/admin/audit">
        <select name="action" defaultValue={action ?? ""}>
          <option value="">Any action</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <select name="actor" defaultValue={actor ?? ""}>
          <option value="">Any actor</option>
          {actors.map((a) => (
            <option key={a.actor} value={a.actor}>
              {a.actor}
            </option>
          ))}
        </select>
        <input name="section" placeholder="Section" defaultValue={section ?? ""} />
        <input name="from" type="date" defaultValue={from ?? ""} />
        <input name="to" type="date" defaultValue={to ?? ""} />
        <button type="submit">Filter</button>
      </form>

      <table className="adm-audit-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Section / slug</th>
            <th>Archived</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.created_at}</td>
              <td>{r.actor}</td>
              <td>{r.action}</td>
              <td>{[r.section, r.slug].filter(Boolean).join(" / ") || "—"}</td>
              <td>{r.archived_at ? "yes" : "pending"}</td>
              <td>
                <details>
                  <summary>view</summary>
                  <pre>before: {r.before ?? "null"}</pre>
                  <pre>after: {r.after ?? "null"}</pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && <p className="adm-list-empty">No matching audit rows.</p>}
      {rows.length === LIMIT && (
        <p className="adm-stats-note">
          Showing the latest {LIMIT} matching rows. Narrow the filters above to
          see older ones.
        </p>
      )}
    </div>
  );
}

/* Every admin write goes through here. The write statement and its audit row
 * are sent together as one env.DB.batch() call — D1 runs a batch as a single
 * transaction, so either both land or neither does. That is the whole
 * atomicity guarantee: no code path can change `content` or `settings`
 * without a matching row in `audit_log` landing in the same commit.
 *
 * `before` must already be resolved to a plain JS value by the caller (a
 * SELECT run and awaited *before* calling this) — a D1 batch is an array of
 * pre-bound statements, so one statement's RETURNING output cannot feed
 * another statement's bindings in the same batch.
 *
 * The WORM copy in R2 is deliberately NOT written here. Doing that inline
 * would be a dual-write: if the D1 batch above already committed and the R2
 * call then fails (timeout, R2 outage), there is no way to roll the D1
 * commit back, and the archive silently falls behind with no record that it
 * did. Instead `archived_at` starts NULL and workers/audit-archiver copies
 * unarchived rows to the WORM bucket on its own cron, retrying forever until
 * it succeeds — eventual consistency instead of a half-done dual-write. */
import { env } from "cloudflare:workers";

type AuditEntry = {
  actor: string;
  action: string;
  section?: string | null;
  slug?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function auditedWrite(
  write: D1PreparedStatement | D1PreparedStatement[],
  entry: AuditEntry,
) {
  const logStmt = env.DB.prepare(
    `INSERT INTO audit_log (actor, action, section, slug, before, after)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(
    entry.actor,
    entry.action,
    entry.section ?? null,
    entry.slug ?? null,
    entry.before === undefined ? null : JSON.stringify(entry.before),
    entry.after === undefined ? null : JSON.stringify(entry.after),
  );

  const writes = Array.isArray(write) ? write : [write];
  const results = await env.DB.batch([...writes, logStmt]);

  /* Best-effort, same pattern as the contact/booking notification mail: a
     mail hiccup must never fail (or, worse, roll back) an admin action that
     already committed. */
  if (entry.action.endsWith(".delete")) {
    await alertDelete(entry).catch(() => {});
  }

  return results[0];
}

const FROM = "notify@hotelthakaliinn.com";
/* The only address wrangler.jsonc's send_email.allowed_destination_addresses
   permits — hardcoded rather than read from settings() so a destructive-action
   alert can never silently stop firing because someone edited a settings row. */
const ALERT_TO = "hotelthakaliinn1@gmail.com";

async function alertDelete(entry: AuditEntry) {
  const what = [entry.section, entry.slug].filter(Boolean).join(" / ") || "(settings)";
  await env.EMAIL.send({
    to: ALERT_TO,
    from: { email: FROM, name: "Thakali Inn admin audit" },
    subject: `Admin delete — ${what} — by ${entry.actor}`,
    text: `${entry.actor} performed ${entry.action} on ${what}.\n\nBefore:\n${JSON.stringify(entry.before, null, 2)}\n`,
  });
}

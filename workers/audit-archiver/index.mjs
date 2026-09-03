const BATCH_LIMIT = 100;

/* The bucket itself enforces write-once-read-many — thakali-inn-audit-archive
   has an indefinite bucket-lock rule covering every key (`wrangler r2 bucket
   lock list thakali-inn-audit-archive`), so a normal put() is already
   immutable the instant it lands: no per-object headers, no S3-compatible
   signing, R2's own lock rule is the WORM guarantee. Removing that rule
   requires Cloudflare account access, which only the developer holds — the
   owner/staff admin accounts only ever authenticate to the site itself. */
async function archive(env) {
  const { results: rows } = await env.DB.prepare(
    `SELECT * FROM audit_log WHERE archived_at IS NULL ORDER BY id ASC LIMIT ${BATCH_LIMIT}`,
  ).all();

  const archivedIds = [];
  for (const row of rows) {
    const key = `${String(row.id).padStart(10, "0")}.json`;
    try {
      await env.ARCHIVE.put(key, JSON.stringify(row), {
        httpMetadata: { contentType: "application/json" },
      });
      archivedIds.push(row.id);
    } catch {
      // Left unarchived; the next cron run retries it. No partial state to
      // clean up — the D1 row is untouched until its R2 copy is confirmed.
    }
  }

  if (archivedIds.length) {
    const placeholders = archivedIds.map((_, i) => `?${i + 1}`).join(", ");
    await env.DB.prepare(
      `UPDATE audit_log SET archived_at = datetime('now') WHERE id IN (${placeholders})`,
    )
      .bind(...archivedIds)
      .run();
  }

  return { archived: archivedIds.length, remaining: rows.length - archivedIds.length };
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a ?? "");
  const bufB = enc.encode(b ?? "");
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export default {
  async scheduled(_event, env) {
    await archive(env);
  },
  async fetch(request, env) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || !timingSafeEqual(token, env.ARCHIVER_TOKEN)) {
      return new Response("forbidden", { status: 403 });
    }
    const result = await archive(env);
    return Response.json(result);
  },
};

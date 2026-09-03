async function mirror(env) {
  let copied = 0, skipped = 0, cursor;
  do {
    const page = await env.MEDIA.list({ cursor });
    for (const obj of page.objects) {
      const existing = await env.MEDIA_BACKUP.head(obj.key);
      if (existing && existing.etag === obj.etag) {
        skipped++;
        continue;
      }
      const src = await env.MEDIA.get(obj.key);
      if (!src) continue;
      await env.MEDIA_BACKUP.put(obj.key, src.body, {
        httpMetadata: src.httpMetadata,
        customMetadata: src.customMetadata,
      });
      copied++;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { copied, skipped };
}

async function restore(env, key) {
  const src = await env.MEDIA_BACKUP.get(key);
  if (!src) return { restored: false, reason: "not found in backup" };
  await env.MEDIA.put(key, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });
  return { restored: true, key };
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
    await mirror(env);
  },
  async fetch(request, env) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || !timingSafeEqual(token, env.BACKUP_TOKEN)) {
      return new Response("forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    const restoreMatch = url.pathname.match(/^\/restore\/(.+)$/);
    if (restoreMatch) {
      const result = await restore(env, decodeURIComponent(restoreMatch[1]));
      return Response.json(result);
    }
    const result = await mirror(env);
    return Response.json(result);
  },
};
